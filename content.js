var interval;
var i = 0;
chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.action == "getDOM") {
            sendResponse(document.documentElement.outerHTML);
        }
        if (request.action == "loginVK") {
            if (document.getElementById('index_email') == null) {
                sendResponse('ALREADY_AUTH');
            }
            else {
                document.getElementById('index_email').value = request.data.phone;
                document.getElementById('index_pass').value = request.data.password;
                if (document.getElementById('index_expire').length) document.getElementById('index_expire').click();
                document.getElementById('index_login_button').click();
                sendResponse('TRYING');
            }
        }
        if (request.action == "loginVK_getResult") {
            var html = document.documentElement.outerHTML;
            if (html.indexOf('Не удается войти') > -1) sendResponse('ERROR');
            else sendResponse('OK');
        }
        if (request.action == 'logoutVK') {
            var link = document.getElementById('top_logout_link');
            if (link.length != 0) link.click();
            sendResponse('OK');
        }
        if (request.action == "loginFB") {
            if (document.getElementById('email') == null) {
                sendResponse('ALREADY_AUTH');
            }
            else {
                document.getElementById('email').value = request.data.phone;
                document.getElementById('pass').value = request.data.password;
                document.getElementById('loginbutton').click();
                sendResponse('TRYING');
            }
        }
        if (request.action == "loginFB_getResult") {
            var html = document.documentElement.outerHTML;
            if (html.indexOf('Проблемы с авторизацией?') > -1) sendResponse('ERROR');
            else sendResponse('OK');
        }
        if (request.action == 'logoutFB') {
            document.getElementById('userNavigationLabel').click();
            setTimeout(function() {
                var links = document.getElementsByClassName('navSubmenu');
                links[8].click();
            }, 1000);
            sendResponse('OK');
        }
        if (request.action == "loginInst") {
            if (document.getElementsByClassName('coreSpriteDesktopNavProfile').length != 0) {
                sendResponse(document.getElementsByClassName('coreSpriteDesktopNavProfile')[0].href
                        .replace('https://www.instagram.com/','').replace('/',''));
            }
            else {
                interval = setInterval(function loginInst (request) {
                    var links = document.getElementsByTagName('a');
                    for (var i = 0; i < links.length; i++) {
                        if (links[i].text == 'Вход') {
                            links[i].click();
                            var linkClicked = true;
                            break;
                        }
                    }
                    if (linkClicked != undefined) {
                        clearInterval(interval);
                        var inputs = document.getElementsByTagName('input');
                        for (var i = 0; i < inputs.length; i++) {
                            if (inputs[i].name == 'username') {
                                inputs[i].click();
                                inputs[i].value = request.data.login;
                            }
                            if (inputs[i].name == 'password') {
                                inputs[i].click();
                                inputs[i].value = request.data.password;
                            }
                        }
                        sendResponse('TRYING');
                    }
                }, 1000, request);
                return true;
            }
        }
        if (request.action == 'loginInst_getResult') {
            var ajax = $.ajax({
                url: 'https://www.instagram.com/accounts/login/ajax/',
                async: false,
                method: 'POST',
                data: {
                    username: request.data.login,
                    password: request.data.password
                },
                contentType: 'application/x-www-form-urlencoded',
                headers: {
                    'x-csrftoken': /"csrf_token": "([^"]+)"/.exec(document.documentElement.outerHTML)[1],
                    'x-instagram-ajax': '1'
                }
            });
            ajax.done(function(data) {
                if (data.authenticated) sendResponse('OK');
                else sendResponse('ERROR');
            });
            ajax.fail(function(jqXHR, textStatus) {
                console.log(jqXHR, textStatus);
                sendResponse('ERROR');
            });
            return true;
        }
        if (request.action == 'logoutInst') {
            var link = document.getElementsByClassName('coreSpriteMobileNavSettings');
            if (link.length == 0) link = document.getElementsByClassName('coreSpriteDesktopNavProfile');
            link[0].click();
            var buttons = document.getElementsByTagName('button');
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].innerHTML == 'Выйти') {
                    buttons[i].click();
                    break;
                }
            }
            sendResponse('OK');
        }
    }
);