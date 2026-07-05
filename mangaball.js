async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    try {
        return await fetchv2(url, headers, options.method || 'GET', options.body || null);
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}

async function getCsrfToken() {
    const response = await soraFetch("https://mangaball.net/");
    if (!response) {
        console.log("[MangaBall] CSRF fetch returned null response");
        throw new Error("CSRF fetch failed - null response");
    }
    console.log("[MangaBall] CSRF fetch status: " + response.status);
    const html = await response.text();
    console.log("[MangaBall] CSRF page length: " + html.length);
    const match = /<meta name="csrf-token" content="([^"]+)">/.exec(html);
    if (!match) {
        console.log("[MangaBall] CSRF token NOT found in HTML");
        throw new Error("CSRF token not found");
    }
    console.log("[MangaBall] CSRF token found: " + match[1].substring(0, 10) + "...");
    return match[1];
}

function extractTitleId(url) {
    const match = /([a-f0-9]{24})\/?$/.exec(url);
    return match ? match[1] : null;
}

async function searchResults(keyword, page = 1) {
    const results = [];
    try {
        console.log("[MangaBall] searchResults called with keyword: " + keyword);

        const csrfToken = await getCsrfToken();
        const postData = "search_input=" + encodeURIComponent(keyword) + "&filters[sort]=updated_chapters_desc&filters[page]=" + page;
        console.log("[MangaBall] POST body: " + postData);

        const response = await soraFetch("https://mangaball.net/api/v1/title/search-advanced/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-TOKEN": csrfToken
            },
            body: postData
        });

        if (!response) {
            console.log("[MangaBall] Search fetch returned null response");
            return [];
        }
        console.log("[MangaBall] Search response status: " + response.status);

        const rawText = await response.text();
        console.log("[MangaBall] Raw response length: " + rawText.length);
        console.log("[MangaBall] Raw response (first 300 chars): " + rawText.substring(0, 300));

        let json;
        try {
            json = JSON.parse(rawText);
        } catch (parseErr) {
            console.log("[MangaBall] Failed to parse JSON: " + parseErr.message);
            return [];
        }

        console.log("[MangaBall] Parsed response code: " + json.code);

        if (json.code === 200 && Array.isArray(json.data)) {
            for (const item of json.data) {
                results.push({
                    id: item.url.trim(),
                    imageURL: item.cover.trim(),
                    title: item.name.trim()
                });
            }
        }

        console.log("[MangaBall] Final results count: " + results.length);
        return results;
    } catch (err) {
        console.log("[MangaBall] searchResults error: " + (err.message || err));
        return [];
    }
}

async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return { description: "Error", tags: [] };
        const html = await response.text();

        const descMatch = /<div class="description-text">[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(html);
        const description = descMatch ? descMatch[1].trim() : "";

        const tags = [];
        const tagRegex = /data-tag-id="[^"]*"[^>]*>([^<]+)<\/span>/g;
        let tagMatch;
        while ((tagMatch = tagRegex.exec(html)) !== null) {
            tags.push(tagMatch[1].trim());
        }

        return { description, tags };
    } catch (err) {
        return { description: "Error", tags: [] };
    }
}

async function extractChapters(url) {
    try {
        const titleId = extractTitleId(url);
        if (!titleId) return { en: [] };

        const csrfToken = await getCsrfToken();
        const postData = "title_id=" + titleId + "&userSettingsEnabled=false";

        const response = await soraFetch("https://mangaball.net/api/v1/chapter/chapter-listing-by-title-id/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-TOKEN": csrfToken
            },
            body: postData
        });

        if (!response) return { en: [] };
        const json = await response.json();
        if (json.code !== 200 || !Array.isArray(json.ALL_CHAPTERS)) {
            return { en: [] };
        }

        const results = [];
        for (const chapter of json.ALL_CHAPTERS) {
            const entries = chapter.translations.map(t => ({
                id: t.url.trim(),
                title: t.name || ("Chapter " + chapter.number),
                chapter: parseFloat(chapter.number_float) || 0,
                scanlation_group: t.group?.name || ""
            }));
            results.push([String(chapter.number), entries]);
        }

        return { en: results };
    } catch (err) {
        return { en: [] };
    }
}

async function extractImages(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return [];
        const html = await response.text();

        const match = /const chapterImages = JSON\.parse\(`(\[.*?\])`\);/.exec(html);
        if (!match) return [];

        const images = JSON.parse(match[1]);
        return images.map(img => img.trim());
    } catch (err) {
        return [];
    }
}
