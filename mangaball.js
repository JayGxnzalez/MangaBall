async function getCsrfToken() {
    try {
        const response = await fetch("https://mangaball.net/");
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
    } catch (err) {
        console.log("[MangaBall] getCsrfToken error: " + (err.message || err));
        throw err;
    }
}

async function searchResults(keyword, page = 1) {
    const results = [];
    try {
        console.log("[MangaBall] searchResults called with keyword: " + keyword);

        const csrfToken = await getCsrfToken();

        const postData = "search_input=" + encodeURIComponent(keyword) + "&filters[sort]=updated_chapters_desc&filters[page]=" + page;
        console.log("[MangaBall] POST body: " + postData);

        const response = await fetch("https://mangaball.net/api/v1/title/search-advanced/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-TOKEN": csrfToken
            },
            body: postData
        });

        console.log("[MangaBall] Search response status: " + response.status);

        const rawText = await response.text();
        console.log("[MangaBall] Raw response length: " + rawText.length);
        console.log("[MangaBall] Raw response (first 500 chars): " + rawText.substring(0, 500));

        let json;
        try {
            json = JSON.parse(rawText);
        } catch (parseErr) {
            console.log("[MangaBall] Failed to parse JSON: " + parseErr.message);
            return [];
        }

        console.log("[MangaBall] Parsed response code: " + json.code);
        console.log("[MangaBall] data field type: " + (Array.isArray(json.data) ? "array, length " + json.data.length : typeof json.data));

        if (json.code === 200 && Array.isArray(json.data)) {
            for (const item of json.data) {
                results.push({
                    id: item.url.trim() + " | " + item._id,
                    imageURL: item.cover.trim(),
                    title: item.name.trim()
                });
            }
        }

        console.log("[MangaBall] Final results count: " + results.length);
        return results;
    } catch (err) {
        console.log("[MangaBall] searchResults error: " + (err.message || err));
        console.log("[MangaBall] error stack: " + (err.stack || "none"));
        return [];
    }
}
