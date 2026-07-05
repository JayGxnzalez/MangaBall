async function getCsrfToken() {
    const response = await fetch("https://mangaball.net/");
    const html = await response.text();
    const match = /<meta name="csrf-token" content="([^"]+)">/.exec(html);
    if (!match) throw new Error("CSRF token not found");
    return match[1];
}

async function searchResults(keyword, page = 1) {
    const results = [];
    try {
        const csrfToken = await getCsrfToken();
        const postData = `search_input=${encodeURIComponent(keyword)}&filters[sort]=updated_chapters_desc&filters[page]=${page}`;

        const response = await fetch("https://mangaball.net/api/v1/title/search-advanced/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-TOKEN": csrfToken
            },
            body: postData
        });

        const json = await response.json();
        if (json.code === 200 && Array.isArray(json.data)) {
            for (const item of json.data) {
                results.push({
                    id: item.url.trim() + " | " + item._id,
                    imageURL: item.cover.trim(),
                    title: item.name.trim()
                });
            }
        }

        return results;
    } catch (err) {
        return [];
    }
}

async function extractDetails(url) {
    try {
        const [pageUrl] = url.split(" | ");
        const response = await fetch(pageUrl);
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
        const [, titleId] = url.split(" | ");
        if (!titleId) return { en: [] };

        const csrfToken = await getCsrfToken();
        const postData = `title_id=${titleId.trim()}&userSettingsEnabled=false`;

        const response = await fetch("https://mangaball.net/api/v1/chapter/chapter-listing-by-title-id/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-TOKEN": csrfToken
            },
            body: postData
        });

        const json = await response.json();
        if (json.code !== 200 || !Array.isArray(json.ALL_CHAPTERS)) {
            return { en: [] };
        }

        const results = [];
        for (const chapter of json.ALL_CHAPTERS) {
            const entries = chapter.translations.map(t => ({
                id: t.url.trim(),
                title: t.name || `Chapter ${chapter.number}`,
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
        const response = await fetch(url);
        const html = await response.text();

        const match = /const chapterImages = JSON\.parse\(`(\[.*?\])`\);/.exec(html);
        if (!match) return [];

        const images = JSON.parse(match[1]);
        return images.map(img => img.trim());
    } catch (err) {
        return [];
    }
}
