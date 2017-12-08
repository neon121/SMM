function callbackFn(details) {
    if (details.isProxy == false) return {};
    if (localStorage.proxyAuth == undefined) return {};
    var auth = localStorage.proxyAuth.split(';');
    return {
        authCredentials: {
            username: auth[0],
            password: auth[1]
        }
    };
}

chrome.webRequest.onAuthRequired.addListener(
    callbackFn,
    {urls: ["<all_urls>"]},
    ['blocking'] 
);