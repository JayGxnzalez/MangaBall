async function getCsrfToken() {
    const response = await fetch("https://mangaball.net/");
    const html = await response.text();
    const match = /<meta name="csrf-token" content="([^"]+)">/.exec(html);
    if (!match) throw new Error("CSRF token not found");
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
        const postData = "search_input=" + encodeURIComponent(keyword);

        const response = await fetch("https://mangaball.net/api/v1/smart-search/search/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-CSRF-Token": csrfToken,
                "X-Requested-With": "XMLHttpRequest",
                "Origin": "https://mangaball.net",
                "Referer": "https://mangaball.net/search-advanced/"
            },
            body: postData
        });
        console.log("[MangaBall] Search response status: " + response.status);

        const json = await response.json();
        console.log("[MangaBall] Response code: " + json.code);

        const manga = json.data && Array.isArray(json.data.manga) ? json.data.manga : [];
        for (const item of manga) {
            let url = item.url.trim();
            if (url.indexOf("http") !== 0) {
                url = "https://mangaball.net" + url;
            }
            results.push({
                id: url,
                imageURL: (item.img || "").trim(),
                title: item.title.trim()
            });
        }

        console.log("[MangaBall] Final results count: " + results.length);
        return JSON.stringify(results);
    } catch (err) {
        console.log("[MangaBall] searchResults error: " + (err.message || err));
        return JSON.stringify(results);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();

        const descMatch = /<div class="description-text">[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(html);
        const description = descMatch ? descMatch[1].trim() : "";

        const tags = [];
        const tagRegex = /data-tag-id="[^"]*"[^>]*>([^<]+)<\/span>/g;
        let tagMatch;
        while ((tagMatch = tagRegex.exec(html)) !== null) {
            tags.push(tagMatch[1].trim());
        }

        return JSON.stringify({ description, tags });
    } catch (err) {
        return JSON.stringify({ description: "Error", tags: [] });
    }
}

async function extractChapters(url) {
    try {
        const titleId = extractTitleId(url);
        if (!titleId) return JSON.stringify({ en: [] });

        const csrfToken = await getCsrfToken();
        const postData = "title_id=" + titleId + "&userSettingsEnabled=false";

        const response = await fetch("https://mangaball.net/api/v1/chapter/chapter-listing-by-title-id/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-CSRF-Token": csrfToken,
                "X-Requested-With": "XMLHttpRequest",
                "Origin": "https://mangaball.net",
                "Referer": "https://mangaball.net/"
            },
            body: postData
        });

        const json = await response.json();
        if (json.code !== 200 || !Array.isArray(json.ALL_CHAPTERS)) {
            return JSON.stringify({ en: [] });
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

        return JSON.stringify({ en: results });
    } catch (err) {
        return JSON.stringify({ en: [] });
    }
}

async function extractImages(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();

        const match = /const chapterImages = JSON\.parse\(`(\[.*?\])`\);/.exec(html);
        if (!match) return JSON.stringify([]);

        const images = JSON.parse(match[1]);
        return JSON.stringify(images.map(img => img.trim()));
    } catch (err) {
        return JSON.stringify([]);
    }
}
