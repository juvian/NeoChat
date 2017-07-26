document.addEventListener("mousedown", function(event){
    if (event.button !== 2) {
        return false;
    }

    var target = event.path.filter(function(el){return el.tagName == "A"}).concat(null)[0];

    if (target && target.tagName == "A" && (target.href.indexOf("/randomfriend.phtml?user=") != -1 || target.href.indexOf("/userlookup.phtml?user=") != -1)) {
        chrome.runtime.sendMessage({type : "contextMenu", user : target.href.split("user=")[1]})
    }
    
});