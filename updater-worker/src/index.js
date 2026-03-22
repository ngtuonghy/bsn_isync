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
      
      console.log(`[worker] incoming request: ${target} ${current_version}`);
  
      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
  
      if (!owner || !repo) {
        console.error(`[worker] missing configuration: owner=${owner}, repo=${repo}`);
        return new Response(JSON.stringify({ error: "Missing GITHUB_OWNER or GITHUB_REPO vars" }), { 
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
  
      try {
        const githubUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
        console.log(`[worker] fetching releases from: ${githubUrl}`);
        const headers = {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Tauri-Updater-Worker"
        };
        if (env.GITHUB_TOKEN) {
          console.log(`[worker] using GITHUB_TOKEN (auth enabled)`);
          headers["Authorization"] = `Bearer ${env.GITHUB_TOKEN}`;
        } else {
          console.warn(`[worker] NO GITHUB_TOKEN FOUND! (rate limits may apply)`);
        }

        const ghResponse = await fetch(githubUrl, { headers });
  
        if (!ghResponse.ok) {
          console.error(`[worker] GitHub API error: ${ghResponse.status}`);
          if (ghResponse.status === 404) {
             return new Response(null, { status: 204 });
          }
          throw new Error(`GitHub API returned ${ghResponse.status}`);
        }
  
        const releases = await ghResponse.json();
        if (!Array.isArray(releases) || releases.length === 0) {
          console.log(`[worker] no releases found on GitHub`);
          return new Response(null, { status: 204 });
        }

        // Helper to compare version strings (simple semver-like)
        const compare = (v1, v2) => {
          const p1 = v1.split('.').map(Number);
          const p2 = v2.split('.').map(Number);
          for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const num1 = p1[i] || 0;
            const num2 = p2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
          }
          return 0;
        };

        // Use the first release (latest)
        const release = releases[0];
        let latestVersion = release.tag_name;
        if (latestVersion.startsWith("v")) {
          latestVersion = latestVersion.substring(1);
        }
  
        console.log(`[worker] latest version: ${latestVersion}, current client: ${current_version}`);

        // Only update if latest > current
        const comp = compare(latestVersion, current_version);
        if (comp <= 0) {
          console.log(`[worker] no update needed (latest ${latestVersion} <= current ${current_version})`);
          return new Response(null, { status: 204 });
        }
  
        console.log(`[worker] update available! searching for assets...`);

        let signatureAsset = release.assets.find(a => a.name.endsWith('.sig'));
        let updateAsset = release.assets.find(a => 
           (target.includes('windows') && (a.name.endsWith('x64-setup.nsis.zip') || a.name.endsWith('.msi.zip') || a.name.endsWith('.exe.zip') || a.name.endsWith('.exe'))) ||
           (target.includes('darwin') && a.name.endsWith('.tar.gz')) ||
           (target.includes('linux') && a.name.endsWith('.AppImage.tar.gz'))
        );
  
        console.log(`[worker] signature asset found: ${!!signatureAsset}, update asset found: ${!!updateAsset}`);

        // If no matching asset or signature, it's effectively "no update" for this platform
        if (!updateAsset || !signatureAsset) {
          console.warn(`[worker] missing required assets (sig=${!!signatureAsset}, update=${!!updateAsset}) for v${latestVersion} on ${target}`);
          return new Response(null, { status: 204 });
        }
  
        console.log(`[worker] fetching signature content from API: ${signatureAsset.url}`);
        const sigResponse = await fetch(signatureAsset.url, {
          headers: {
            "Accept": "application/octet-stream",
            "User-Agent": "Tauri-Updater-Worker",
            ...(env.GITHUB_TOKEN ? { "Authorization": `Bearer ${env.GITHUB_TOKEN}` } : {})
          }
        });

        if (!sigResponse.ok) {
           console.error(`[worker] failed to fetch signature from API: ${sigResponse.status}`);
           throw new Error(`Could not fetch signature (status: ${sigResponse.status})`);
        }
        const signatureText = await sigResponse.text();
  
        const platformData = {
          signature: signatureText.trim(),
          url: updateAsset.browser_download_url
        };
  
        const responseJson = {
          version: latestVersion,
          notes: release.body || "New update available.",
          pub_date: release.published_at,
          platforms: {
            ...(target.includes('windows') ? { 
              "windows-x86_64-nsis": platformData,
              "windows-x86_64": platformData,
            } : {}),
            ...(target.includes('darwin') || target.includes('macos') ? {
               "darwin-x86_64": platformData,
               "darwin-aarch64": platformData,
               "macos-x86_64": platformData,
               "macos-aarch64": platformData
            } : {}),
            ...(target.includes('linux') ? {
               "linux-x86_64": platformData,
               "linux-aarch64": platformData
            } : {})
          }
        };
  
        console.log(`[worker] returning SUCCESS 200 with version ${latestVersion}`);
        return new Response(JSON.stringify(responseJson), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
  
      } catch (err) {
        console.error(`[worker] catch error: ${err.message}`);
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }
  };
