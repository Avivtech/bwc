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

// START countdown single-card style
{
    const styleId = 'bwc-countdown-single-card-style';
    const rootSelectors = [
        '.countdown',
        '.countdown-wrap',
        '.countdown-wrapper',
        '.countdown-container',
        '.countdown-grid',
        '.countdown-timer',
        '[countdown="wrapper"]',
        '[count-down-date]',
        '[data-countdown]',
    ];
    const unitSelectors = [
        '.countdown-card',
        '.countdown-unit',
        '.countdown-item',
        '.countdown-block',
        '.time-card',
        '.time-unit',
        '.timer-card',
        '.timer-unit',
        '[countdown="days"]',
        '[countdown="hours"]',
        '[countdown="minutes"]',
        '[countdown="seconds"]',
        '[number-slot="days"]',
        '[number-slot="hours"]',
        '[number-slot="minutes"]',
        '[number-slot="seconds"]',
    ];
    const rootSelector = rootSelectors.join(', ');
    const unitSelector = unitSelectors.join(', ');
    const unitChildSelector = rootSelectors
        .map(function (selector) {
            return selector + ' > :is(' + unitSelector + ')';
        })
        .join(', ');
    const adjacentUnitSelector = rootSelectors
        .map(function (selector) {
            return selector + ' > :is(' + unitSelector + ') + :is(' + unitSelector + ')';
        })
        .join(', ');

    function injectCountdownStyles() {
        if (document.getElementById(styleId) !== null) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            ${rootSelector} {
                display: inline-flex !important;
                align-items: stretch;
                gap: 0 !important;
                max-width: 100%;
                padding: 16px 18px;
                border: 1px solid #d8d0c6;
                border-radius: 8px;
                background: #fffdfa;
                box-shadow: 0 12px 32px rgba(40, 30, 20, 0.08);
                overflow: hidden;
            }

            ${unitChildSelector} {
                flex: 1 1 0;
                min-width: 0;
                padding: 0 18px !important;
                border: 0 !important;
                border-radius: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
            }

            ${adjacentUnitSelector} {
                border-inline-start: 1px solid #ddd4c8 !important;
            }

            @media (max-width: 767px) {
                ${rootSelector} {
                    width: 100%;
                    padding: 12px 10px;
                }

                ${unitChildSelector} {
                    padding: 0 10px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectCountdownStyles, { once: true });
    } else {
        injectCountdownStyles();
    }
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
