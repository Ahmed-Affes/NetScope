import { spawn } from 'child_process';
import http from 'http';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\dwarf\\AppData\\Local\\Temp\\chrome_debug_' + Date.now();

const chrome = spawn(chromePath, [
  '--remote-debugging-port=9333',
  `--user-data-dir=${userDataDir}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'http://localhost:1420'
]);

chrome.stderr.on('data', d => console.log('[Chrome stderr]', d.toString()));
chrome.stdout.on('data', d => console.log('[Chrome stdout]', d.toString()));

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await wait(2000);
  console.log("Checking CDP endpoint...");
  
  http.get('http://127.0.0.1:9333/json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      console.log("CDP JSON:", data);
      try {
        const pages = JSON.parse(data);
        const page = pages.find(p => p.type === 'page' || p.url.includes('1420'));
        if (!page) {
          console.log("No page found.");
          chrome.kill();
          return;
        }
        console.log("Found page WebSocket:", page.webSocketDebuggerUrl);
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        ws.onopen = () => {
          console.log("WebSocket connected! Enabling Runtime & Console...");
          ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
          ws.send(JSON.stringify({ id: 2, method: "Console.enable" }));
          ws.send(JSON.stringify({ id: 3, method: "Log.enable" }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.method === "Runtime.exceptionThrown") {
            console.error(">>> EXCEPTION THROWN:", JSON.stringify(msg.params.exceptionDetails, null, 2));
          } else if (msg.method === "Runtime.consoleAPICalled") {
            console.log(">>> CONSOLE [" + msg.params.type + "]:", msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(" "));
          }
        };
        await wait(5000);
        console.log("Done waiting. Killing Chrome.");
        chrome.kill();
        process.exit(0);
      } catch (err) {
        console.error("Error parsing CDP:", err);
        chrome.kill();
        process.exit(1);
      }
    });
  }).on('error', err => {
    console.error("CDP connection failed:", err.message);
    chrome.kill();
    process.exit(1);
  });
}

run();
