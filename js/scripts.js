var datajson;
$.get('data.json', null, function(data) {datajson = $.parseJSON(data);});
$(function() {
    chrome.storage.local.get("username", function(data) {
        if (data.username) login(data.username);
        else logout();
    });
    
    $('#tryLogin').click(function() {
        var user = $('#auth [name=user]').val();
        var password = $('#auth [name=password]').val();
        if (datajson.users[user] != undefined && datajson.users[user].password == md5(password)) login(user);
        else $('#auth .status').text('Логин/пароль неверен');
    });
    
    $('#listing .unauth').click(function() {unauthAll();});
    $('#listing .logout').click(function() {logout();});
});
function login(username) {
    chrome.storage.local.set({username: username});
    $('#listing .username').text(username);
    $('#auth').hide();
    $('#listing').show();
    drawAuthTable(username);
}
function logout() {
    chrome.storage.local.remove('username');
    $('#auth').show();
    $('#listing').hide();
    $('#listing table tr:not(.etalon)').remove();
}
function drawAuthTable(user) {
    var auths = datajson.users[user].auths;
    for (var id in auths) {
        var auth = auths[id];
        var etalon = $('#listing table .etalon').clone().removeClass('etalon');
        with (etalon) {
            attr('data-id', id);
            find('.vk').text(auth.vk.login);
            find('.fb').text(auth.fb.login);
            find('.inst').text(auth.inst.login);
            click(function() {authThis(this);});
            appendTo($('#listing table').eq(parseInt(id) % 2));
        }
    }
    chrome.storage.local.get('authId', function(data) {
        if (data.authId != undefined) $('#listing table [data-id=' + data.authId + ']').addClass('active');
    });
}
function authThis(obj) {
    $('#listing tr.active').removeClass('active');
    var tr = $(obj);
    var id = tr.attr('data-id');
    chrome.storage.local.set({vk: false, fb: false, inst: false}, function() {
        chrome.storage.local.get(['username', 'authId'], function(data) {
            try {
                setStatus('Не закрывайте окно расширения, пока все авторизации не пройдут');
                $('.dontClose').css('visibility','visible');
                setProxy(datajson.users[data.username].auths[id].proxy);
                authVK(datajson.users[data.username].auths[id].vk);
                authFB(datajson.users[data.username].auths[id].fb);
                authInst(datajson.users[data.username].auths[id].inst);
                tr.addClass('active');
                chrome.storage.local.set({authId: id});
                chrome.storage.onChanged.addListener(function() {
                    chrome.storage.local.get(['vk', 'fb' ,'inst'], function(data) {
                        if (data.vk == true && data.fb == true && data.inst == true) {
                            setStatus('Процесс авторизации завершен. Окно приложения можно закрыть');
                            $('.dontClose').css('visibility','hidden');
                        }
                    });
                });
            } catch (e) {
                setStatus(e.message);
                console.error(e);
            }
        })
    });
}
function unauthAll() {
    $('#listing tr.active').removeClass('active');
    unsetProxy();
    unAuthVK();
    unAuthFB();
    unAuthInst();
    chrome.storage.local.remove('authId');
}
function setStatus(msg) {
    $('pre').text($('pre').text() + msg + "\r\n");
}
function setProxy(data) {
    setStatus('Proxy авторизация');
    chrome.proxy.settings.set({
        value: {
            mode: "fixed_servers",
            rules: {
                singleProxy: {
                    scheme: data.type,
                    host: data.ip,
                    port: parseInt(data.port)
                }
            }
        }
    });
    if (data.user != undefined) {
        localStorage.proxyAuth = [data.user, data.password].join(';');
    }
}
function unsetProxy() {
    setStatus('Proxy выход');
    chrome.proxy.settings.set({value: {mode: "system"}});
    localStorage.proxyAuth = undefined;
}
function authVK(data) {
    setStatus('VK авторизация');
    chrome.tabs.create({ url: 'https://vk.com/', active: false}, function(tab) {
        chrome.tabs.onUpdated.addListener(function listenerVK(tabId, info) {
            if (info.status == 'complete' && tabId == tab.id) {
                chrome.tabs.onUpdated.removeListener(listenerVK);
                chrome.tabs.sendMessage(tab.id, {action: "loginVK", data: data}, {}, function(response) {
                    if (response == 'ALREADY_AUTH') {
                        setStatus ('VK уже есть авторизация. Выходим');
                        unAuthVK(true);
                        chrome.tabs.remove(tab.id);
                        return false;
                    }
                    else chrome.tabs.onUpdated.addListener(function listenerVK_getResult(tabId, info) {
                        if (info.status === 'complete' && tabId === tab.id) {
                            chrome.tabs.onUpdated.removeListener(listenerVK_getResult);
                            chrome.tabs.sendMessage(tab.id, {action: "loginVK_getResult"}, {}, function(response) {
                                if (response == 'OK') {
                                    setStatus('VK авторизация произведена');
                                    chrome.tabs.remove(tab.id);
                                    chrome.storage.local.set({vk: true});
                                }
                                else setStatus('VK ошибка авторизации, см. вкладку');
                            });
                        }
                    });
                });
            }
        });
    });
}
function unAuthVK(runAuth) {
    setStatus('VK выход');
    chrome.storage.local.set({vk: false});
    chrome.tabs.create({ url: 'https://vk.com/', active: false}, function(tab) {
        chrome.tabs.onUpdated.addListener(function listenerVK_unauth(tabId, info) {
            if (info.status === 'complete' && tabId === tab.id) {
                chrome.tabs.onUpdated.removeListener(listenerVK_unauth);
                chrome.tabs.sendMessage(tab.id, {action: "logoutVK"}, {}, function(response) {
                    chrome.tabs.onUpdated.addListener(function listenerVK_logout_getResult(tabId, info) {
                        if (info.status === 'complete' && tabId === tab.id) {
                            chrome.tabs.onUpdated.removeListener(listenerVK_logout_getResult);
                            setStatus('VK выход произведен');
                            chrome.tabs.remove(tab.id);
                            if (runAuth != undefined) {
                                chrome.storage.local.get(['username', 'authId'], function(data) {
                                    authVK(datajson.users[data.username].auths[data.authId].vk);
                                });
                            }
                        }
                    });
                });
            }
        });
    });
}
function authFB(data) {
    setStatus('FB авторизация');
    chrome.tabs.create({ url: 'https://www.facebook.com/', active: false}, function(tab) {
        chrome.tabs.onUpdated.addListener(function listenerFB(tabId, info) {
            if (info.status == 'complete' && tabId == tab.id) {
                chrome.tabs.onUpdated.removeListener(listenerFB);
                chrome.tabs.sendMessage(tab.id, {action: "loginFB", data: data}, {}, function(response) {
                    if (response == 'ALREADY_AUTH') {
                        setStatus('FB уже есть авторизация. Выходим')
                        unAuthFB(true);
                        chrome.tabs.remove(tab.id);
                        return false;
                    }
                    else chrome.tabs.onUpdated.addListener(function listenerFB_getResult(tabId, info) {
                        if (info.status === 'complete' && tabId === tab.id) {
                            chrome.tabs.onUpdated.removeListener(listenerFB_getResult);
                            chrome.tabs.sendMessage(tab.id, {action: "loginFB_getResult"}, {}, function(response) {
                                if (response == 'OK') {
                                    setStatus('FB авторизация произведена');
                                    chrome.tabs.remove(tab.id);
                                    chrome.storage.local.set({fb: true});
                                }
                                else setStatus('FB ошибка авторизации, см. вкладку');
                            });
                        }
                    });
                });
            }
        });
    });
}
function unAuthFB(runAuth) {
    setStatus('FB выход');
    chrome.storage.local.set({fb: false});
    chrome.tabs.create({ url: 'https://www.facebook.com/', active: false}, function(tab) {
        chrome.tabs.onUpdated.addListener(function listenerFB_unauth(tabId, info) {
            if (info.status === 'complete' && tabId === tab.id) {
                chrome.tabs.onUpdated.removeListener(listenerFB_unauth);
                chrome.tabs.sendMessage(tab.id, {action: "logoutFB"}, {}, function(response) {
                    chrome.tabs.onUpdated.addListener(function listenerFB_logout_getResult(tabId, info) {
                        if (info.status === 'complete' && tabId === tab.id) {
                            chrome.tabs.onUpdated.removeListener(listenerFB_logout_getResult);
                            setStatus('FB выход произведен');
                            setTimeout(function(tabId, runAuth) {
                                chrome.tabs.remove(tabId);
                                if (runAuth != undefined) {
                                    chrome.storage.local.get(['username', 'authId'], function(data) {
                                        authFB(datajson.users[data.username].auths[data.authId].fb);
                                    });
                                }
                            } , 1000, tab.id, runAuth);
                        }
                    });
                });
            }
        });
    });
}
function authInst(data) {
    setStatus('Instagram авторизация');
    chrome.tabs.create({ url: 'https://www.instagram.com/', active: true}, function(tab) {
        chrome.tabs.onUpdated.addListener(function listenerInst(tabId, info) {
            if (info.status == 'complete' && tabId == tab.id) {
                chrome.tabs.onUpdated.removeListener(listenerInst);
                chrome.tabs.sendMessage(tab.id, {action: "loginInst", data: data}, {}, function(response) {
                    if (response != 'TRYING') {
                        localStorage.loginSavedForInst = response;
                        setStatus ('Instagram уже есть авторизация. Выходим');
                        unAuthInst(true);
                        chrome.tabs.remove(tab.id);
                        return false;
                    }
                    else chrome.tabs.sendMessage(tab.id, {action: "loginInst_getResult", data: data}, {}, 
                        function(response) {
                            if (response == 'OK') {
                                setStatus('Instagram авторизация произведена');
                                chrome.tabs.remove(tab.id);
                                chrome.storage.local.set({inst: true});
                            }
                            else if (response == 'ERROR') setStatus('Instagram  ошибка авторизации, см. вкладку');

                    });
                });
            }
        });
    });
}
function unAuthInst(runAuth) {
    setStatus('Instagram выход');
    chrome.storage.local.set({inst: false});
    if (localStorage.loginSavedForInst == undefined) {
        setStatus('Приложение не может выйти из Instagram, т.к. не известен последний логин в этой системе. ' +
                    'Выполните выход самостоятельно и повторите попытку');
        return;
    }
    chrome.tabs.create({ url: 'https://www.instagram.com/' + localStorage.loginSavedForInst, active: false}, function(tab) {
        chrome.tabs.onUpdated.addListener(function listenerInst_unauth(tabId, info) {
            if (info.status === 'complete' && tabId === tab.id) {
                chrome.tabs.onUpdated.removeListener(listenerInst_unauth);
                chrome.tabs.sendMessage(tab.id, {action: "logoutInst"}, {}, function(response) {
                    chrome.tabs.onUpdated.addListener(function listenerInst_logout_getResult(tabId, info) {
                        if (info.status === 'complete' && tabId === tab.id) {
                            chrome.tabs.onUpdated.removeListener(listenerInst_logout_getResult);
                            setStatus('Instagram выход произведен');
                            chrome.tabs.remove(tab.id);
                            if (runAuth != undefined) {
                                chrome.storage.local.get(['username', 'authId'], function(data) {
                                    authInst(datajson.users[data.username].auths[data.authId].inst);
                                });
                            }
                        }
                    });
                });
            }
        });
    });
}