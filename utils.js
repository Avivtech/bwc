// START change "er" to superscript
{
    const config = {
        selectors: [
            '.wine-name',
            '.event-wine-list-name',
            '.wine-page-h1',
            '.event-wines-list p',
        ],
    };

    function formatSup(element) {
        const text = element.textContent;
        const index = text.indexOf('1er');
        if (index !== -1) {
            const textBefore = text.slice(0, index + 1);
            const textAfter = text.slice(index + 3);

            element.textContent = '';
            element.appendChild(document.createTextNode(textBefore));

            const ele = document.createElement('sup');
            ele.textContent = 'er';
            element.appendChild(ele);

            element.appendChild(document.createTextNode(textAfter));
        }
    }

    for (let i = 0; i < config.selectors.length; i++) {
        const elements = document.querySelectorAll(config.selectors[i]);
        for (let i2 = 0; i2 < elements.length; i2++) {
            formatSup(elements[i2]);
        }
    }
}

// START add space for thousand marker

const priceElements = document.querySelectorAll('.wine-display-price');
Array.prototype.forEach.call(priceElements, function (element) {
    const existingValue = element.textContent;
    const newValue = String(existingValue).replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
    element.textContent = newValue;
});

// START dynamic full page height
const root = document.querySelector(':root');

window.addEventListener('scroll', getInnerHeight);
window.addEventListener('load', getInnerHeight);
window.addEventListener('resize', getInnerHeight);

function getInnerHeight() {
    if (root !== null) {
        root.style.setProperty('--full', window.innerHeight + 'px');
    }
    //console.log(window.innerHeight + 'px');
}


// START Welcome Banner cookie
function setCookie(name, value, days) {
    var expires = '';
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + (value || '') + expires + '; path=/';
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function cta() {
    if (typeof gsap === 'undefined') {
        return;
    }

    gsap.fromTo(
        '.hero-cta',
        {
            opacity: 0,
            y: 50,
        },
        {
            delay: 2,
            opacity: 1,
            y: 0,
            duration: 1,
        }
    );
}

function heroLoad() {
    const target = document.querySelector('.hero-txt-a');
    const heroWrap = document.getElementById('heroWrap');

    if (
        target === null ||
        heroWrap === null ||
        typeof Splitting === 'undefined' ||
        typeof gsap === 'undefined'
    ) {
        return;
    }

    const results = Splitting({
        target: target,
        by: 'lines',
    });
    if (results.length === 0) {
        return;
    }

    heroWrap.style.opacity = '1';

    results[0].lines.forEach((line, index) => {
        line.forEach((word) => {
            gsap.from(word, {
                opacity: 0,
                y: 50,
                delay: index / 4,
                duration: 2,
            });
        });
    });

    cta();
}

window.addEventListener('load', (event) => {
    var url = window.location.pathname;
    var bgcCookie = getCookie('burgundy-wine-cookie');

    if (bgcCookie === null) {
        setCookie('burgundy-wine-cookie', 'welcome', 1);
        if (typeof $ === 'function') {
            $('.welcome-wrap').addClass('show');
        } else {
            const welcomeWrap = document.querySelector('.welcome-wrap');
            if (welcomeWrap !== null) {
                welcomeWrap.classList.add('show');
            }
        }
        //console.log('cookie set')
    } else if (url === '/') {
        //console.log('Cookie exists: ' + bgcCookie)
        heroLoad();
    }
});
