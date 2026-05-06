const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-asset",
  "build",
  "AssetUris.js"
);

if (!fs.existsSync(filePath)) {
  console.log("expo-asset patch skipped: AssetUris.js not found.");
  process.exit(0);
}

const original = fs.readFileSync(filePath, "utf8");

if (original.includes("EVA Expo Go URL mutation patch")) {
  console.log("expo-asset patch already applied.");
  process.exit(0);
}

const oldBlock = `export function getManifestBaseUrl(manifestUrl) {
    const urlObject = new URL(manifestUrl);
    let nextProtocol = urlObject.protocol;
    // Change the scheme to http(s) if it is exp(s)
    if (nextProtocol === 'exp:') {
        nextProtocol = 'http:';
    }
    else if (nextProtocol === 'exps:') {
        nextProtocol = 'https:';
    }
    urlObject.protocol = nextProtocol;
    // Trim filename, query parameters, and fragment, if any
    const directory = urlObject.pathname.substring(0, urlObject.pathname.lastIndexOf('/') + 1);
    urlObject.pathname = directory;
    urlObject.search = '';
    urlObject.hash = '';
    // The URL spec doesn't allow for changing the protocol to \`http\` or \`https\`
    // without a port set so instead, we'll just swap the protocol manually.
    return urlObject.protocol !== nextProtocol
        ? urlObject.href.replace(urlObject.protocol, nextProtocol)
        : urlObject.href;
}`;

const newBlock = `export function getManifestBaseUrl(manifestUrl) {
    const urlObject = new URL(manifestUrl);
    let nextProtocol = urlObject.protocol;
    // Change the scheme to http(s) if it is exp(s)
    if (nextProtocol === 'exp:') {
        nextProtocol = 'http:';
    }
    else if (nextProtocol === 'exps:') {
        nextProtocol = 'https:';
    }
    // EVA Expo Go URL mutation patch: React Native's URL implementation can expose
    // readonly URL fields, so build the base URL without mutating the URL object.
    const pathname = urlObject.pathname || '/';
    const directory = pathname.substring(0, pathname.lastIndexOf('/') + 1) || '/';
    const auth = urlObject.username
        ? urlObject.username + (urlObject.password ? ':' + urlObject.password : '') + '@'
        : '';
    return nextProtocol + '//' + auth + urlObject.host + directory;
}`;

if (!original.includes(oldBlock)) {
  console.log("expo-asset patch skipped: expected AssetUris.js block was not found.");
  process.exit(0);
}

fs.writeFileSync(filePath, original.replace(oldBlock, newBlock));
console.log("expo-asset patch applied.");
