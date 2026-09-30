import http from 'http';

async function main() {
  console.log("Checking Edge debugger...");
  http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const pages = JSON.parse(data);
        console.log("Pages found:", pages.map(p => ({ title: p.title, url: p.url, ws: p.webSocketDebuggerUrl })));
        const page = pages.find(p => p.url.includes('1420'));
        if (!page) {
          console.log("No 1420 page found yet.");
          return;
        }
        
        const wsUrl = page.webSocketDebuggerUrl;
        console.log("Connecting to WebSocket:", wsUrl);
        // Using built-in WebSocket if Node 22+
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          console.log("Connected to CDP!");
          ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
          ws.send(JSON.stringify({ id: 2, method: "Log.enable" }));
        };
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.method === "Runtime.exceptionThrown") {
            console.error("RUNTIME EXCEPTION:", JSON.stringify(msg.params.exceptionDetails, null, 2));
          } else if (msg.method === "Runtime.consoleAPICalled") {
            console.log("CONSOLE " + msg.params.type + ":", msg.params.args.map(a => a.value || a.description).join(" "));
          }
        };
        setTimeout(() => {
          console.log("Done listening.");
          process.exit(0);
        }, 4000);
      } catch (err) {
        console.error("Parse error:", err);
      }
    });
  }).on('error', (err) => {
    console.error("HTTP error:", err.message);
  });
}

main();
