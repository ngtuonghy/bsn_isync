// src/index.js

export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      
      const pathParts = url.pathname.split('/').filter(p => p !== '');
      if (pathParts.length < 4 || pathParts[0] !== 'api' || pathParts[1] !== 'update') {
        return new Response("Not Found", { status: 404 });
      }
      
      const target = pathParts[2];
      const current_version = pathParts[3];
  
      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
  
      if (!owner || !repo) {
        return new Response(JSON.stringify({ error: "Missing GITHUB_OWNER or GITHUB_REPO vars" }), { 
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
  
      try {
        const githubUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
        const headers = {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Tauri-Updater-Worker"
        };
        if (env.GITHUB_TOKEN) {
          headers["Authorization"] = `Bearer ${env.GITHUB_TOKEN}`;
        }

        const ghResponse = await fetch(githubUrl, { headers });
  
        if (!ghResponse.ok) {
          if (ghResponse.status === 404) {
             return new Response(null, { status: 204 });
          }
          throw new Error(`GitHub API returned ${ghResponse.status}`);
        }
  
        const releases = await ghResponse.json();
        if (!Array.isArray(releases) || releases.length === 0) {
          return new Response(null, { status: 204 });
        }

        // Use the first release (usually the most recent one including prereleases)
        const release = releases[0];
        let latestVersion = release.tag_name;
        if (latestVersion.startsWith("v")) {
          latestVersion = latestVersion.substring(1);
        }
  
        if (latestVersion === current_version) {
          return new Response(null, { status: 204 });
        }
  
        let signatureAsset = release.assets.find(a => a.name.endsWith('.sig'));
        if (!signatureAsset) {
           return new Response(JSON.stringify({ error: "No signature (.sig) found in release. Make sure you have configured TAURI_SIGNING_PRIVATE_KEY in your GitHub Secrets." }), { 
             status: 404,
             headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
           });
        }
  
        let updateAsset = release.assets.find(a => 
           (target.includes('windows') && (a.name.endsWith('x64-setup.nsis.zip') || a.name.endsWith('.msi.zip') || a.name.endsWith('.exe.zip'))) ||
           (target.includes('darwin') && a.name.endsWith('.tar.gz')) ||
           (target.includes('linux') && a.name.endsWith('.AppImage.tar.gz'))
        );
  
        if (!updateAsset) {
           return new Response(JSON.stringify({ error: `No suitable update file found for target: ${target}` }), { 
             status: 404,
             headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
           });
        }
  
        const sigResponse = await fetch(signatureAsset.browser_download_url);
        if (!sigResponse.ok) {
           throw new Error("Could not fetch signature");
        }
        const signatureText = await sigResponse.text();
  
        const responseJson = {
          version: latestVersion,
          notes: release.body || "New update available.",
          pub_date: release.published_at,
          platforms: {
            [target]: {
              signature: signatureText.trim(),
              url: updateAsset.browser_download_url
            }
          }
        };
  
        return new Response(JSON.stringify(responseJson), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
  
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }
  };
