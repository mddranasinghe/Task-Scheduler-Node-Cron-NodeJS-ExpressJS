

// index.html page water pump 



/*dot---*/
document.getElementById("page1").onclick=function(){location.href="index2.html"}





var startX = 0;

window.addEventListener('touchstart', function(event) {
    startX = event.touches[0].clientX;
});

window.addEventListener('touchend', function(event) {
    var endX = event.changedTouches[0].clientX;
    var threshold = 50; // Minimum distance required to trigger navigation (in pixels)

    if (startX - endX > threshold) {
        // Swipe from right to left
        var nextPageLink = document.getElementById('nextPage').href;
        if (nextPageLink) {
            window.location.href = nextPageLink;
        }
    } else if (endX - startX > threshold) {
        // Swipe from left to right
        var prevPageLink = document.getElementById('prevPage').href;
        if (prevPageLink) {
            window.location.href = prevPageLink;
        }
    }
});
