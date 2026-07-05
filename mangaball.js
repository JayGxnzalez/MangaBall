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
        for (let i = 0; i < manga.length; i++) {
            const item = manga[i];
            if (!item || !item.url || !item.title) continue;

            let url = String(item.url).trim();
            if (url.indexOf("http") !== 0) {
                url = "https://mangaball.net" + url;
            }

            results.push({
                id: url,
                imageURL: String(item.img || "").trim(),
                title: String(item.title).trim()
            });
        }

        console.log("[MangaBall] Final results count: " + results.length);
        return results;
    } catch (err) {
        console.log("[MangaBall] searchResults error: " + (err.message || err));
        return results;
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
            tags.push(String(tagMatch[1]).trim());
        }

        return { description: String(description), tags: tags };
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
            return { en: [] };
        }

        const results = [];
        for (let i = 0; i < json.ALL_CHAPTERS.length; i++) {
            const chapter = json.ALL_CHAPTERS[i];
            const translations = Array.isArray(chapter.translations) ? chapter.translations : [];
            const entries = [];
            for (let j = 0; j < translations.length; j++) {
                const t = translations[j];
                if (!t || !t.url) continue;
                entries.push({
                    id: String(t.url).trim(),
                    title: String(t.name || ("Chapter " + chapter.number)),
                    chapter: parseFloat(chapter.number_float) || 0,
                    scanlation_group: String((t.group && t.group.name) ? t.group.name : "")
                });
            }
            if (entries.length > 0) {
                results.push([String(chapter.number), entries]);
            }
        }

        return { en: results };
    } catch (err) {
        return { en: [] };
    }
}

async function extractImages(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();

        const match = /const chapterImages = JSON\.parse\(`(\[.*?\])`\);/.exec(html);
        if (!match) return [];

        const images = JSON.parse(match[1]);
        const out = [];
        for (let i = 0; i < images.length; i++) {
            if (images[i]) out.push(String(images[i]).trim());
        }
        return out;
    } catch (err) {
        return [];
    }
}
