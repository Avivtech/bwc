(function () {
  if (window.__bwcWinesListViewRegistered) {
    return;
  }

  window.__bwcWinesListViewRegistered = true;

  const PAGE_PATH = "/the-wines-list-view-test";
  const WEBFLOW_PAGINATION_PAGE_SIZE = 100;
  const LOADER_HIDE_AFTER_ITEM_COUNT = WEBFLOW_PAGINATION_PAGE_SIZE;
  const FALLBACK_PAGES_PER_BATCH = 1;
  const DOMAIN_SORT_COLLATOR = new Intl.Collator("fr", { sensitivity: "base" });
  const WINES_LOADED_TEXT_DEFAULT = "WINES";
  const WINES_LOADED_TEXT_LOADING = "Loading all Wines";
  const DEFAULT_CATEGORY_ORDER = [
    "אדום",
    "לבן",
    "מבעבע",
    "FINE / MARC DE BOURGOGNE",
  ];
  const CATEGORY_CONFIGS = [
    {
      key: "year",
      dropdownSelector: ".yeardropdown",
      clearSelector: ".cta.filter-all",
    },
    {
      key: "cat",
      dropdownSelector: ".catdropdown",
      clearSelector: ".cta.filter-all",
    },
    {
      key: "domaine",
      dropdownSelector: ".domainedropdown",
      clearSelector: ".cta.filter-all",
    },
    {
      key: "subRegion",
      dropdownSelector: ".areadropdown",
      clearSelector: ".cta.filter-all",
      hasSelectAllOption: true,
    },
  ];
  const VIEW_SELECTORS = [
    ".cat-sep-wrap",
    ".wines-list-wrap",
    ".wine-list",
    ".wine-item",
    ".wine-label-link",
    ".wine-grid",
    ".wine-inner",
    ".wine-name",
    ".wine-domaine",
    ".wine-add-wrap",
    ".wine-year-cat-wrap",
    ".cta-buy",
  ];
  const styles = `
    .filters-m-toggle.filter-on {
      text-decoration: underline;
    }

    @media (max-width: 991px) {
      .sort-sticky {
        height: calc(100vh - 60px) !important;
      }
    }
  `;

  const state = {
    activeFilters: createEmptyFilters(),
    allWinePagesLoaded: false,
    currentView: "cards",
    currentPage: 0,
    filterCallbacks: [],
    filterControls: [],
    domains: [],
    wineEntries: [],
    sortAscending: true,
    applyFilters: null,
    updatePagination: null,
    clearAllFilters: null,
  };
  let manualLoadPromise = null;
  const loaderState = {
    element: null,
    hidden: false,
    hiding: false,
    initialized: false,
    startedAt: 0,
  };

  function createEmptyFilters() {
    return {
      text: "",
      year: new Set(),
      domaine: new Set(),
      cat: new Set(),
      subRegion: new Set(),
    };
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeLower(value) {
    return normalizeText(value).toLocaleLowerCase();
  }

  function getWineItemDomainName(item) {
    return normalizeText($(".wine-domaine.add-domaine", item) && $(".wine-domaine.add-domaine", item).textContent);
  }

  function getWineItemName(item) {
    return normalizeText($(".wine-name", item) && $(".wine-name", item).textContent);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function debounce(fn, delay) {
    let timeoutId;

    return function debounced() {
      const args = arguments;
      const context = this;

      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function nextFrame() {
    return new Promise(function (resolve) {
      window.requestAnimationFrame(function () {
        resolve();
      });
    });
  }

  function setCheckboxState(input, checked) {
    if (!input) {
      return;
    }

    input.checked = checked;

    const customCheckbox = input.parentElement && input.parentElement.querySelector(".w-checkbox-input");
    if (customCheckbox) {
      customCheckbox.classList.toggle("w--redirected-checked", checked);
    }
  }

  function injectStyles() {
    if (document.getElementById("bwc-wines-list-view-test-styles")) {
      return;
    }

    const styleTag = document.createElement("style");
    styleTag.id = "bwc-wines-list-view-test-styles";
    styleTag.textContent = styles;
    document.head.appendChild(styleTag);
  }

  function parseActiveFilters() {
    const parsedFilters = createEmptyFilters();
    const activeValue = new URL(window.location.href).searchParams.get("active");

    if (!activeValue) {
      return parsedFilters;
    }

    let rawValue = activeValue;

    try {
      rawValue = decodeURIComponent(activeValue);
    } catch (error) {
      rawValue = activeValue;
    }

    let json;
    try {
      json = JSON.parse(rawValue);
    } catch (error) {
      console.warn("Failed to parse active filters from URL:", error);
      return parsedFilters;
    }

    if (json && typeof json === "object") {
      parsedFilters.text = normalizeText(json.text);

      ["year", "domaine", "cat", "subRegion"].forEach(function (key) {
        const values = json[key];
        if (values && typeof values === "object") {
          Object.keys(values).forEach(function (label) {
            if (values[label]) {
              parsedFilters[key].add(normalizeText(label));
            }
          });
        }
      });
    }

    return parsedFilters;
  }

  function serializeActiveFilters() {
    return {
      text: state.activeFilters.text,
      year: setToRecord(state.activeFilters.year),
      domaine: setToRecord(state.activeFilters.domaine),
      cat: setToRecord(state.activeFilters.cat),
      subRegion: setToRecord(state.activeFilters.subRegion),
    };
  }

  function setToRecord(values) {
    const record = {};
    values.forEach(function (value) {
      record[value] = true;
    });
    return record;
  }

  function hasActiveFilters() {
    return (
      normalizeText(state.activeFilters.text) !== "" ||
      state.activeFilters.year.size > 0 ||
      state.activeFilters.domaine.size > 0 ||
      state.activeFilters.cat.size > 0 ||
      state.activeFilters.subRegion.size > 0
    );
  }

  function updateUrlState() {
    const nextUrl = new URL(window.location.href);

    if (hasActiveFilters()) {
      nextUrl.searchParams.set("active", JSON.stringify(serializeActiveFilters()));
    } else {
      nextUrl.searchParams.set("active", "");
    }

    window.history.replaceState(null, "", nextUrl);
  }

  function dispatchFilterCallbacks() {
    state.filterCallbacks.forEach(function (callback) {
      if (typeof callback !== "function") {
        return;
      }

      try {
        callback();
      } catch (error) {
        console.error("filter callback failed:", error);
      }
    });
  }

  function initLoader() {
    if (loaderState.initialized) {
      return;
    }

    loaderState.initialized = true;
    loaderState.element = document.getElementById("loader");
    loaderState.startedAt = Date.now();
  }

  async function hideLoader() {
    if (!loaderState.element || loaderState.hidden || loaderState.hiding) {
      return;
    }

    loaderState.hiding = true;

    const elapsed = Date.now() - loaderState.startedAt;
    if (elapsed < 250) {
      await wait(250 - elapsed);
    }

    loaderState.element.classList.add("done");
    await wait(400);
    loaderState.element.classList.add("hide");
    loaderState.hidden = true;
  }

  function initFilterBarMove() {
    const filtersWrap = document.getElementById("filtersWrap");
    const navFilterWrap = document.getElementById("navFiltersWrap");
    const filters = document.getElementById("filters");
    const nav = document.getElementById("navbar");
    const clearFilters = document.getElementById("clearFilters");
    const wineFiltersDrop = document.getElementById("wineFiltersDrop");
    const wineCount = document.getElementById("wineCount");

    if (
      !filtersWrap ||
      !navFilterWrap ||
      !filters ||
      !nav ||
      !clearFilters ||
      !wineFiltersDrop ||
      !wineCount
    ) {
      return;
    }

    const anchor = document.createComment("bwc-filters-anchor");
    filtersWrap.insertBefore(anchor, filters);

    let isMoved = false;

    const updateFilterBar = debounce(function () {
      const isDesktop = window.innerWidth > 991;
      const shouldMove = isDesktop && window.scrollY > 200;

      if (shouldMove && !isMoved) {
        navFilterWrap.appendChild(filters);

        if (wineFiltersDrop.children.length >= 3) {
          wineFiltersDrop.insertBefore(clearFilters, wineFiltersDrop.children[3]);
        } else {
          wineFiltersDrop.appendChild(clearFilters);
        }

        clearFilters.style.border = "none";
        nav.classList.add("scrolled");
        isMoved = true;
      }

      if (!shouldMove && isMoved) {
        filtersWrap.insertBefore(filters, anchor.nextSibling);
        wineCount.appendChild(clearFilters);
        clearFilters.style.borderLeft = "1px solid #c6c6c6";
        nav.classList.remove("scrolled");
        isMoved = false;
      }

      if (!isDesktop && filters.parentElement !== filtersWrap) {
        filtersWrap.insertBefore(filters, anchor.nextSibling);
        wineCount.appendChild(clearFilters);
        clearFilters.style.borderLeft = "1px solid #c6c6c6";
        nav.classList.remove("scrolled");
        isMoved = false;
      }
    }, 50);

    window.addEventListener("scroll", updateFilterBar, { passive: true });
    window.addEventListener("resize", updateFilterBar);
    updateFilterBar();
  }

  function initToggleView() {
    const listView = document.getElementById("listView");
    const cardsView = document.getElementById("cardsView");

    if (!listView || !cardsView) {
      return;
    }

    state.currentView = "cards";

    function applyView(view) {
      const nextView = view === "cards" ? "cards" : "list";
      const isCardView = nextView === "cards";

      state.currentView = nextView;

      cardsView.classList.toggle("current", isCardView);
      listView.classList.toggle("current", !isCardView);

      VIEW_SELECTORS.forEach(function (selector) {
        $$(selector).forEach(function (element) {
          element.classList.toggle("card", isCardView);
        });
      });
    }

    cardsView.addEventListener("click", function (event) {
      event.preventDefault();
      applyView("cards");
      refreshLastItemBorders();
    });

    listView.addEventListener("click", function (event) {
      event.preventDefault();
      applyView("list");
      refreshLastItemBorders();
    });

    window.applyWineView = applyView;
    applyView(state.currentView);
  }

  function sortDomainFilterOptions() {
    const parent = $(".filter-drop-list.domainedropdown.w-dropdown-list");
    const wrapper = parent && $(".w-dyn-items", parent);

    if (!wrapper) {
      return;
    }

    const items = $$(".w-dyn-item", wrapper);
    const collator = new Intl.Collator("fr", { sensitivity: "base" });

    items
      .sort(function (leftItem, rightItem) {
        const leftText = normalizeText($(".filter-chk-box-txt", leftItem) && $(".filter-chk-box-txt", leftItem).textContent);
        const rightText = normalizeText($(".filter-chk-box-txt", rightItem) && $(".filter-chk-box-txt", rightItem).textContent);

        return collator.compare(leftText, rightText);
      })
      .forEach(function (item) {
        wrapper.appendChild(item);
      });
  }

  function splitItemsIntoDomains() {
    const domainMap = new Map();
    const domains = $$(".domaine-item.w-dyn-item");

    state.domains = domains.map(function (wrapper) {
      const info = $(".domaine-item-info", wrapper);
      const nameElement = $(".domaine-item-name", wrapper);
      const childLocation = $(".wines-list-wrap", wrapper);
      const parentName = normalizeText($(".parent-domaine", wrapper) && $(".parent-domaine", wrapper).textContent);
      const domain = {
        wrapper: wrapper,
        info: info,
        nameElement: nameElement,
        name: normalizeText(nameElement && nameElement.textContent),
        nameKey: normalizeLower(nameElement && nameElement.textContent),
        parentName: parentName,
        parentKey: normalizeLower(parentName),
        childLocation: childLocation,
        injectElement: $(".parent-inject", wrapper),
      };

      if (domain.nameElement && domain.parentName) {
        domain.nameElement.classList.add("is-sub-wine");
      }

      wrapper.dataset.domainName = domain.name;
      wrapper.dataset.domainNameKey = domain.nameKey;
      wrapper.dataset.parentDomain = domain.parentName;
      wrapper.dataset.parentDomainKey = domain.parentKey;

      if (domain.nameKey) {
        domainMap.set(domain.nameKey, domain);
      }

      return domain;
    });

    $$(".wine-item").forEach(function (item) {
      const domainName = normalizeText($(".wine-domaine.add-domaine", item) && $(".wine-domaine.add-domaine", item).textContent);
      const targetDomain = domainMap.get(normalizeLower(domainName));

      if (!targetDomain || !targetDomain.childLocation) {
        console.warn("Wine item has no matching domain:", domainName, item);
        return;
      }

      targetDomain.childLocation.appendChild(item);
    });

    state.domains.forEach(function (domain) {
      if (!domain.parentKey) {
        return;
      }

      const parentDomain = domainMap.get(domain.parentKey);

      if (!parentDomain || !parentDomain.injectElement) {
        console.warn("Parent domain was not found for child domain:", domain.parentName, domain.name);
        return;
      }

      const childNames = normalizeText(parentDomain.injectElement.textContent)
        ? normalizeText(parentDomain.injectElement.textContent).split(/\s{2,}|,\s*/).filter(Boolean)
        : [];

      if (childNames.indexOf(domain.name) === -1) {
        childNames.push(domain.name);
      }

      parentDomain.injectElement.textContent = childNames.join(", ");
    });

    pruneEmptyDomains();
  }

  function pruneEmptyDomains() {
    state.domains = state.domains.filter(function (domain) {
      const hasWines = Boolean($(".wine-item", domain.wrapper));
      const hasChildLabel = domain.injectElement && normalizeText(domain.injectElement.textContent) !== "";

      if (hasWines || hasChildLabel) {
        return true;
      }

      if (!state.allWinePagesLoaded) {
        return true;
      }

      domain.wrapper.remove();
      return false;
    });
  }

  function getCategoryTemplate() {
    return $(".templateelements .cat-sep") || $(".cat-sep");
  }

  function getCategoryOrderIndex(domain, category) {
    const orderFromDom = $$(".order-class", domain.wrapper)
      .map(function (element) {
        return normalizeText(element.textContent);
      })
      .filter(Boolean);
    const preferredOrder = orderFromDom.length ? orderFromDom : DEFAULT_CATEGORY_ORDER;
    const categoryIndex = preferredOrder.indexOf(category);

    if (categoryIndex !== -1) {
      return categoryIndex;
    }

    return preferredOrder.length + 100;
  }

  function ensureCategoryBlock(domain, category) {
    const container = $(".winecatgroupcontainer", domain.wrapper);
    const template = getCategoryTemplate();

    if (!container || !template || !category) {
      return null;
    }

    let block = $$(".cat-sep", container).find(function (candidate) {
      return normalizeText(candidate.dataset.category) === category;
    });

    if (!block) {
      block = template.cloneNode(true);

      const title = $(".cat-sep-text", block);
      if (title) {
        title.textContent = category;
      }

      block.dataset.category = category;

      const blocks = $$(".cat-sep", container);
      const targetOrder = getCategoryOrderIndex(domain, category);
      const collator = new Intl.Collator("fr", { sensitivity: "base" });
      const nextBlock = blocks.find(function (candidate) {
        const candidateCategory = normalizeText(candidate.dataset.category || $(".cat-sep-text", candidate) && $(".cat-sep-text", candidate).textContent);
        const candidateOrder = getCategoryOrderIndex(domain, candidateCategory);

        if (targetOrder !== candidateOrder) {
          return targetOrder < candidateOrder;
        }

        return collator.compare(category, candidateCategory) < 0;
      });

      container.insertBefore(block, nextBlock || null);
    }

    return $(".wines-list-wrap", block);
  }

  function getDomainRenderOrderMap() {
    const orderMap = new Map();

    $$(".domaine-list.w-dyn-items .domaine-item.w-dyn-item").forEach(function (domainWrapper, index) {
      const name = normalizeLower(
        $(".domaine-item-name", domainWrapper) && $(".domaine-item-name", domainWrapper).textContent,
      );

      if (name && !orderMap.has(name)) {
        orderMap.set(name, index);
      }
    });

    return orderMap;
  }

  async function appendWineItemsToBootedDom(items) {
    const domainsByKey = new Map();
    const domainOrderMap = getDomainRenderOrderMap();
    const sortedItems = items.slice().sort(function (leftItem, rightItem) {
      const leftDomainKey = normalizeLower(getWineItemDomainName(leftItem));
      const rightDomainKey = normalizeLower(getWineItemDomainName(rightItem));
      const leftOrder = domainOrderMap.has(leftDomainKey) ? domainOrderMap.get(leftDomainKey) : Number.MAX_SAFE_INTEGER;
      const rightOrder = domainOrderMap.has(rightDomainKey) ? domainOrderMap.get(rightDomainKey) : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      const domainComparison = DOMAIN_SORT_COLLATOR.compare(getWineItemDomainName(leftItem), getWineItemDomainName(rightItem));

      if (domainComparison !== 0) {
        return domainComparison;
      }

      return DOMAIN_SORT_COLLATOR.compare(getWineItemName(leftItem), getWineItemName(rightItem));
    });
    let appendedCount = 0;
    let lastDomainKey = "";

    state.domains.forEach(function (domain) {
      if (domain.nameKey) {
        domainsByKey.set(domain.nameKey, domain);
      }
    });

    for (const item of sortedItems) {
      const domainName = getWineItemDomainName(item);
      const category = normalizeText($(".wine-cat", item) && $(".wine-cat", item).textContent);
      const domainKey = normalizeLower(domainName);
      const domain = domainsByKey.get(domainKey);
      const targetLocation = domain && ensureCategoryBlock(domain, category);

      if (!targetLocation) {
        continue;
      }

      if (lastDomainKey && lastDomainKey !== domainKey) {
        await nextFrame();
      }

      targetLocation.appendChild(item);
      lastDomainKey = domainKey;
      appendedCount += 1;
    }

    if (!appendedCount) {
      return 0;
    }

    collectWineEntries();

    if (state.allWinePagesLoaded) {
      removeUnusedYears();
    }

    if (typeof state.applyFilters === "function") {
      state.applyFilters();
    } else {
      refreshLastItemBorders();
    }

    return appendedCount;
  }

  function initWineType() {
    const baseTemplate = $(".templateelements .cat-sep") || $(".cat-sep");

    if (!baseTemplate) {
      return;
    }

    state.domains.forEach(function (domain) {
      const container = $(".winecatgroupcontainer", domain.wrapper);
      if (!container) {
        return;
      }

      const wines = $$(".wine-item", container);
      if (!wines.length) {
        return;
      }

      const orderFromDom = $$(".order-class", domain.wrapper)
        .map(function (element) {
          return normalizeText(element.textContent);
        })
        .filter(Boolean);

      const preferredOrder = orderFromDom.length ? orderFromDom : DEFAULT_CATEGORY_ORDER;
      const groupedWines = new Map();

      wines.forEach(function (wine) {
        const category = normalizeText($(".wine-cat", wine) && $(".wine-cat", wine).textContent);
        if (!category) {
          return;
        }

        if (!groupedWines.has(category)) {
          groupedWines.set(category, []);
        }

        groupedWines.get(category).push(wine);
      });

      const orderedCategories = preferredOrder
        .filter(function (category, index, list) {
          return groupedWines.has(category) && list.indexOf(category) === index;
        })
        .concat(
          Array.from(groupedWines.keys())
            .filter(function (category) {
              return preferredOrder.indexOf(category) === -1;
            })
            .sort(new Intl.Collator("fr", { sensitivity: "base" }).compare),
        );

      container.innerHTML = "";

      orderedCategories.forEach(function (category) {
        const template = baseTemplate.cloneNode(true);
        const title = $(".cat-sep-text", template);
        const childLocation = $(".wines-list-wrap", template);

        if (!title || !childLocation) {
          return;
        }

        title.textContent = category;
        template.dataset.category = category;

        groupedWines.get(category).forEach(function (wine) {
          childLocation.appendChild(wine);
        });

        container.appendChild(template);
      });
    });
  }

  function collectWineEntries() {
    state.wineEntries = $$(".wine-item").map(function (item) {
      const domainWrapper = item.closest(".domaine-item.w-dyn-item");
      const domainName = normalizeText($(".wine-domaine.add-domaine", item) && $(".wine-domaine.add-domaine", item).textContent);
      const parentName = normalizeText($(".parent-domaine", domainWrapper) && $(".parent-domaine", domainWrapper).textContent);
      const domainInject = normalizeText($(".parent-inject", domainWrapper) && $(".parent-inject", domainWrapper).textContent);
      const year = normalizeText($(".wine-year.add-year:not(.w-condition-invisible)", item) && $(".wine-year.add-year:not(.w-condition-invisible)", item).textContent);
      const category = normalizeText($(".wine-cat", item) && $(".wine-cat", item).textContent);
      const subRegion = normalizeText($(".sub-region", item) && $(".sub-region", item).textContent);
      const name = normalizeText($(".wine-name", item) && $(".wine-name", item).textContent);
      const slug = normalizeText($(".slug.w-embed", item) && $(".slug.w-embed", item).textContent);
      const price = normalizeText($(".wine-display-price", item) && $(".wine-display-price", item).textContent);
      const domainHaystack = [domainName, parentName, domainInject].filter(Boolean).join(" | ");
      const compiledSearch = [year, name, domainHaystack, category, subRegion, slug, price].join(" | ");

      return {
        element: item,
        domainWrapper: domainWrapper,
        year: year,
        category: category,
        subRegion: subRegion,
        compiledSearchLower: normalizeLower(compiledSearch),
        domainHaystackLower: normalizeLower(domainHaystack),
      };
    });
  }

  function removeUnusedYears() {
    if (!state.allWinePagesLoaded) {
      return;
    }

    const usedYears = new Set(
      $$(".wine-item .wine-year.add-year")
        .filter(function (element) {
          return !element.classList.contains("w-condition-invisible");
        })
        .map(function (element) {
          return normalizeText(element.textContent);
        })
        .filter(Boolean),
    );
    const yearContainer = $(".filter-drop-list.yeardropdown.w-dropdown-list");

    if (!yearContainer) {
      return;
    }

    $$(".w-dyn-item", yearContainer).forEach(function (item) {
      const label = normalizeText($(".filter-chk-box-txt", item) && $(".filter-chk-box-txt", item).textContent);
      if (!label || usedYears.has(label)) {
        return;
      }

      item.remove();
    });
  }

  function initWineSort() {
    const sortTrigger = $(".wine-list-sort");
    const arrow = $(".sort-arrow");
    const mobileArrow = $(".sort-arrow.mobile-arrow");

    if (!sortTrigger) {
      return;
    }

    const collator = new Intl.Collator("fr", { sensitivity: "base" });

    function buildGroups() {
      const groups = [];
      const childrenByParent = new Map();
      const domainsByKey = new Map();

      state.domains
        .filter(function (domain) {
          return domain.wrapper.isConnected;
        })
        .forEach(function (domain) {
          domainsByKey.set(domain.nameKey, domain);
          if (domain.parentKey) {
            if (!childrenByParent.has(domain.parentKey)) {
              childrenByParent.set(domain.parentKey, []);
            }

            childrenByParent.get(domain.parentKey).push(domain);
            return;
          }

          groups.push(domain);
        });

      state.domains
        .filter(function (domain) {
          return domain.wrapper.isConnected && domain.parentKey && !domainsByKey.has(domain.parentKey);
        })
        .forEach(function (orphan) {
          groups.push(orphan);
        });

      return {
        topLevel: groups,
        childrenByParent: childrenByParent,
      };
    }

    function updateArrowDirection() {
      const rotation = state.sortAscending ? "0deg" : "180deg";
      if (arrow) {
        arrow.style.transform = "rotate(" + rotation + ")";
      }
      if (mobileArrow) {
        mobileArrow.style.transform = "rotate(" + rotation + ")";
      }
    }

    function sortDomains() {
      const container = $(".domaine-list.w-dyn-items");
      if (!container) {
        return;
      }

      const groups = buildGroups();
      const topLevel = groups.topLevel.slice().sort(function (leftDomain, rightDomain) {
        return collator.compare(leftDomain.name, rightDomain.name);
      });

      if (!state.sortAscending) {
        topLevel.reverse();
      }

      topLevel.forEach(function (domain) {
        container.appendChild(domain.wrapper);

        const children = (groups.childrenByParent.get(domain.nameKey) || []).slice().sort(function (leftDomain, rightDomain) {
          return collator.compare(leftDomain.name, rightDomain.name);
        });

        if (!state.sortAscending) {
          children.reverse();
        }

        children.forEach(function (childDomain) {
          container.appendChild(childDomain.wrapper);
        });
      });

      updateArrowDirection();

      if (typeof state.updatePagination === "function") {
        state.updatePagination({ resetPage: false });
      }
    }

    sortTrigger.addEventListener("click", function (event) {
      event.preventDefault();
      state.sortAscending = !state.sortAscending;
      sortDomains();
    });

    sortDomains();
  }

  function buildFilterControls() {
    state.filterControls = CATEGORY_CONFIGS.map(function (config) {
      const dropdown = $(config.dropdownSelector);
      const wrapper = dropdown && dropdown.parentElement;
      const inputs = wrapper ? $$(".filter-chk-box input", wrapper) : [];
      const items = inputs.map(function (input, index) {
        const labelElement = input.closest(".filter-chk-box");
        const label = normalizeText(input.parentElement && $(".filter-chk-box-txt", input.parentElement) && $(".filter-chk-box-txt", input.parentElement).textContent);
        return {
          input: input,
          labelElement: labelElement,
          label: label,
          isSelectAll: Boolean(config.hasSelectAllOption && index === 0),
        };
      });

      return {
        key: config.key,
        wrapper: wrapper,
        toggle: wrapper && $(".filter-toggle", wrapper),
        count: wrapper && $(".checkbox-activefilter-count", wrapper),
        clearButton: wrapper && $(config.clearSelector, wrapper),
        items: items,
        hasSelectAllOption: Boolean(config.hasSelectAllOption),
      };
    }).filter(function (control) {
      return control.wrapper && control.items.length;
    });

    state.filterControls.forEach(function (control) {
      const validLabels = new Set(
        control.items
          .filter(function (item) {
            return !item.isSelectAll;
          })
          .map(function (item) {
            return item.label;
          }),
      );
      const nextValues = new Set();

      state.activeFilters[control.key].forEach(function (value) {
        if (validLabels.has(value)) {
          nextValues.add(value);
        }
      });

      if (control.hasSelectAllOption && control.items[0] && state.activeFilters[control.key].has(control.items[0].label)) {
        validLabels.forEach(function (value) {
          nextValues.add(value);
        });
      }

      state.activeFilters[control.key] = nextValues;
    });
  }

  function syncControlState(control) {
    const activeValues = state.activeFilters[control.key];
    const regularItems = control.items.filter(function (item) {
      return !item.isSelectAll;
    });
    const activeCount = activeValues.size;

    control.items.forEach(function (item) {
      if (item.isSelectAll) {
        if (!regularItems.length) {
          setCheckboxState(item.input, false);
          return;
        }

        const allSelected = regularItems.every(function (regularItem) {
          return activeValues.has(regularItem.label);
        });
        setCheckboxState(item.input, allSelected);
        return;
      }

      setCheckboxState(item.input, activeValues.has(item.label));
    });

    if (control.count) {
      control.count.textContent = String(activeCount);
      control.count.style.display = activeCount ? "block" : "none";
    }

    if (control.toggle) {
      control.toggle.classList.toggle("active-filters-included", activeCount > 0);
    }

    if (control.clearButton) {
      control.clearButton.dataset.reverse = activeCount ? "false" : "true";
      const textElement = $(".cta-txt", control.clearButton);
      if (textElement) {
        textElement.textContent = activeCount ? "נקה" : "הכל";
      } else {
        control.clearButton.textContent = activeCount ? "נקה" : "הכל";
      }
    }
  }

  function selectAllForControl(control) {
    const activeValues = state.activeFilters[control.key];
    activeValues.clear();

    control.items.forEach(function (item) {
      if (!item.isSelectAll) {
        activeValues.add(item.label);
      }
    });
  }

  function clearControl(control) {
    state.activeFilters[control.key].clear();
  }

  function initFilters() {
    buildFilterControls();

    const countTarget = $(".wine-visible-count-target");
    const search = document.getElementById("search");
    const clearButtons = $$(".clear-all-filters");

    function syncSearchValueClass() {
      if (!search) {
        return;
      }

      search.classList.toggle("value", normalizeText(search.value) !== "");
    }

    function refreshMobileFilterState() {
      if (window.innerWidth >= 991) {
        return;
      }

      const toggle = $(".filters-m-toggle");
      if (!toggle) {
        return;
      }

      toggle.classList.toggle("filter-on", hasActiveFilters());
    }

    function applyFilters() {
      const textNeedle = normalizeLower(state.activeFilters.text);
      const filtersActive = hasActiveFilters();
      let visibleWineCount = 0;
      const visibleChildrenByParent = new Map();

      state.wineEntries.forEach(function (entry) {
        const matchesText = textNeedle === "" || entry.compiledSearchLower.indexOf(textNeedle) !== -1;
        const matchesYear = state.activeFilters.year.size === 0 || state.activeFilters.year.has(entry.year);
        const matchesCategory = state.activeFilters.cat.size === 0 || state.activeFilters.cat.has(entry.category);
        const matchesSubRegion =
          state.activeFilters.subRegion.size === 0 || state.activeFilters.subRegion.has(entry.subRegion);
        const matchesDomain =
          state.activeFilters.domaine.size === 0 ||
          Array.from(state.activeFilters.domaine).some(function (selectedDomain) {
            return entry.domainHaystackLower.indexOf(normalizeLower(selectedDomain)) !== -1;
          });
        const isVisible = matchesText && matchesYear && matchesCategory && matchesSubRegion && matchesDomain;

        entry.element.dataset.filterVisible = isVisible ? "true" : "false";
        entry.element.style.display = isVisible ? "" : "none";

        if (isVisible) {
          visibleWineCount += 1;
        }
      });

      state.domains.forEach(function (domain) {
        const categoryBlocks = $$(".cat-sep", domain.wrapper);
        let hasVisibleCategory = false;

        categoryBlocks.forEach(function (block) {
          const hasVisibleWines = $$(".wine-item", block).some(function (wineItem) {
            return wineItem.dataset.filterVisible === "true";
          });

          block.style.display = hasVisibleWines ? "" : "none";
          hasVisibleCategory = hasVisibleCategory || hasVisibleWines;
        });

        domain.wrapper.dataset.filterVisible = hasVisibleCategory ? "true" : "false";

        if (hasVisibleCategory && domain.parentKey) {
          visibleChildrenByParent.set(domain.parentKey, true);
        }
      });

      state.domains.forEach(function (domain) {
        const showForChildren = !domain.parentKey && visibleChildrenByParent.has(domain.nameKey);
        const showDomain = domain.wrapper.dataset.filterVisible === "true" || showForChildren;

        domain.wrapper.dataset.groupVisible = showDomain ? "true" : "false";
        domain.wrapper.style.display = showDomain ? "" : "none";
      });

      if (countTarget) {
        countTarget.textContent = String(visibleWineCount);
      }

      clearButtons.forEach(function (button) {
        button.style.display = filtersActive ? "" : "none";
      });

      state.filterControls.forEach(syncControlState);
      syncSearchValueClass();
      updateUrlState();
      dispatchFilterCallbacks();
      refreshMobileFilterState();
    }

    state.applyFilters = applyFilters;

    function clearAllFilters(event) {
      if (event) {
        event.preventDefault();
      }

      state.activeFilters = createEmptyFilters();

      if (search) {
        search.value = "";
      }

      state.filterControls.forEach(function (control) {
        syncControlState(control);
      });

      applyFilters();
    }

    state.clearAllFilters = clearAllFilters;

    clearButtons.forEach(function (button) {
      button.addEventListener("click", clearAllFilters);
    });

    if (search) {
      search.value = state.activeFilters.text;
      search.addEventListener("input", debounce(function () {
        state.activeFilters.text = normalizeText(search.value);
        applyFilters();
      }, 150));
    }

    state.filterControls.forEach(function (control) {
      control.items.forEach(function (item) {
        function handleItemToggle() {
          if (item.isSelectAll) {
            if (item.input.checked) {
              selectAllForControl(control);
            } else {
              clearControl(control);
            }

            applyFilters();
            return;
          }

          if (item.input.checked) {
            state.activeFilters[control.key].add(item.label);
          } else {
            state.activeFilters[control.key].delete(item.label);
          }

          applyFilters();
        }

        item.input.addEventListener("change", handleItemToggle);

        if (item.labelElement) {
          item.labelElement.addEventListener("click", function () {
            window.setTimeout(handleItemToggle, 0);
          });
        }
      });

      if (control.clearButton) {
        control.clearButton.addEventListener("click", function (event) {
          event.preventDefault();

          if (state.activeFilters[control.key].size > 0) {
            clearControl(control);
          } else {
            selectAllForControl(control);
          }

          applyFilters();
        });
      }

      syncControlState(control);
    });

    applyFilters();
  }

  function refreshLastItemBorders() {
    $$(".wines-list-wrap").forEach(function (list) {
      $$(".wine-inner.no-border", list).forEach(function (inner) {
        inner.classList.remove("no-border");
      });

      const visibleItems = $$(".wine-item", list).filter(function (item) {
        return window.getComputedStyle(item).display !== "none";
      });
      const lastItem = visibleItems[visibleItems.length - 1];
      const inner = lastItem && $(".wine-inner", lastItem);

      if (inner) {
        inner.classList.add("no-border");
      }
    });
  }

  function initPagination() {
    const arrowLeft = $(".paination-arrow.arrow-left");
    const arrowRight = $(".paination-arrow.arrow-right");
    const paginationContainer = $(".pagination-links-wrap");
    const paginationFullContainer = $(".pagination-containr");
    const templateLink = $(".pagination-link");
    const emptyState = $(".wine-list-empty-state");
    const pageSize = 10;

    if (!arrowLeft || !arrowRight || !paginationContainer || !templateLink || !emptyState) {
      return;
    }

    const linkTemplate = templateLink.cloneNode(true);

    function buildGroups() {
      const domainsByKey = new Map();
      const childrenByParent = new Map();

      state.domains.forEach(function (domain) {
        if (!domain.wrapper.isConnected) {
          return;
        }

        domainsByKey.set(domain.nameKey, domain);
      });

      state.domains.forEach(function (domain) {
        if (!domain.wrapper.isConnected || !domain.parentKey || !domainsByKey.has(domain.parentKey)) {
          return;
        }

        if (!childrenByParent.has(domain.parentKey)) {
          childrenByParent.set(domain.parentKey, []);
        }

        childrenByParent.get(domain.parentKey).push(domain);
      });

      return state.domains
        .filter(function (domain) {
          return domain.wrapper.isConnected && (!domain.parentKey || !domainsByKey.has(domain.parentKey));
        })
        .map(function (domain) {
          return {
            topLevel: domain,
            children: childrenByParent.get(domain.nameKey) || [],
          };
        });
    }

    function renderPaginationLink(index) {
      const link = linkTemplate.cloneNode(true);

      link.textContent = String(index + 1).padStart(2, "0");
      link.classList.remove("current-page");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        state.currentPage = index;
        updatePagination({ resetPage: false, scrollToTop: true });
      });

      paginationContainer.appendChild(link);
    }

    function updateArrowState(pageCount) {
      arrowLeft.classList.toggle("disabled", state.currentPage === 0);
      arrowRight.classList.toggle("disabled", state.currentPage >= pageCount - 1);
    }

    function updatePagination(options) {
      const settings = options || {};
      const groups = buildGroups().filter(function (group) {
        if (group.topLevel.wrapper.dataset.groupVisible === "true") {
          return true;
        }

        return group.children.some(function (childDomain) {
          return childDomain.wrapper.dataset.filterVisible === "true";
        });
      });
      const pageCount = Math.ceil(groups.length / pageSize);

      if (settings.resetPage) {
        state.currentPage = 0;
      }

      state.currentPage = pageCount ? clamp(state.currentPage, 0, pageCount - 1) : 0;

      paginationContainer.innerHTML = "";

      if (!groups.length) {
        state.domains.forEach(function (domain) {
          domain.wrapper.style.display = "none";
        });

        emptyState.style.display = "block";
        if (paginationFullContainer) {
          paginationFullContainer.style.display = "none";
        }
        updateArrowState(1);
        return;
      }

      for (let index = 0; index < pageCount; index += 1) {
        renderPaginationLink(index);
      }

      state.domains.forEach(function (domain) {
        if (domain.wrapper.dataset.groupVisible === "true") {
          domain.wrapper.style.display = "";
        } else {
          domain.wrapper.style.display = "none";
        }
      });

      const groupsOnPage = groups.slice(state.currentPage * pageSize, (state.currentPage + 1) * pageSize);

      state.domains.forEach(function (domain) {
        domain.wrapper.style.display = "none";
      });

      groupsOnPage.forEach(function (group) {
        const hasVisibleChildren = group.children.some(function (childDomain) {
          return childDomain.wrapper.dataset.filterVisible === "true";
        });

        if (group.topLevel.wrapper.dataset.groupVisible === "true") {
          if (group.topLevel.wrapper.dataset.filterVisible === "true" || hasVisibleChildren) {
            group.topLevel.wrapper.style.display = "";
          }
        }

        group.children.forEach(function (childDomain) {
          if (childDomain.wrapper.dataset.filterVisible === "true") {
            childDomain.wrapper.style.display = "";
          }
        });
      });

      emptyState.style.display = "none";
      if (paginationFullContainer) {
        paginationFullContainer.style.display = pageCount > 1 ? "flex" : "none";
      }

      $$(".pagination-link", paginationContainer).forEach(function (link, index) {
        link.classList.toggle("current-page", index === state.currentPage);
      });

      updateArrowState(pageCount);

      if (settings.scrollToTop) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      refreshLastItemBorders();

      if (typeof window.applyWineView === "function") {
        window.applyWineView(state.currentView);
      }
    }

    arrowLeft.addEventListener("click", function (event) {
      event.preventDefault();
      state.currentPage = clamp(state.currentPage - 1, 0, Number.MAX_SAFE_INTEGER);
      updatePagination({ resetPage: false, scrollToTop: true });
    });

    arrowRight.addEventListener("click", function (event) {
      event.preventDefault();
      state.currentPage += 1;
      updatePagination({ resetPage: false, scrollToTop: true });
    });

    state.updatePagination = updatePagination;
    state.filterCallbacks.push(function () {
      updatePagination({ resetPage: true, scrollToTop: false });
    });
  }

  function initSearchUi() {
    const search = document.getElementById("search");
    const searchForm = document.getElementById("searchForm");
    const searchX = document.getElementById("searchX");

    if (!search) {
      return;
    }

    function syncValueClass() {
      search.classList.toggle("value", normalizeText(search.value) !== "");
    }

    search.addEventListener("blur", syncValueClass);
    search.addEventListener("input", syncValueClass);
    syncValueClass();

    if (searchForm) {
      searchForm.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
        }
      });
    }

    if (searchX) {
      searchX.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (typeof state.clearAllFilters === "function") {
          state.clearAllFilters();
        } else {
          search.value = "";
          syncValueClass();
        }
      });
    }
  }

  function initMobileFilterRelay() {
    const toggle = document.querySelector(".filters-m-toggle");
    const continueButton = document.querySelector(".m-continue");
    const closeButton = document.querySelector(".filter-close");
    const dropdown = document.getElementById("wineFiltersDrop");

    if (!toggle || !dropdown) {
      return;
    }

    function closeMobileFilters(event) {
      if (event) {
        event.preventDefault();
      }

      if (dropdown.classList.contains("w--open")) {
        toggle.click();
      }
    }

    if (continueButton) {
      continueButton.addEventListener("click", closeMobileFilters);
    }

    if (closeButton) {
      closeButton.addEventListener("click", closeMobileFilters);
    }
  }

  function initCart() {
    if (window.__bwcCartInitialized) {
      return;
    }

    if (typeof window.runINIT !== "function") {
      return;
    }

     if (!$(".cart-item")) {
      window.__bwcCartInitialized = true;
      return;
    }

    window.__bwcCartInitialized = true;
    window.runINIT();
  }

  function boot() {
    if (window.location.pathname !== PAGE_PATH) {
      return;
    }

    if (window.__bwcWinesListViewBooted) {
      return;
    }

    window.__bwcWinesListViewBooted = true;

    injectStyles();
    initFilterBarMove();
    initCart();
    sortDomainFilterOptions();
    splitItemsIntoDomains();
    initWineType();
    collectWineEntries();
    removeUnusedYears();
    state.activeFilters = parseActiveFilters();
    initToggleView();
    initPagination();
    initFilters();
    initSearchUi();
    initMobileFilterRelay();
    initWineSort();
    refreshLastItemBorders();
  }

  function getWineItemCount() {
    return document.querySelectorAll(".wine-item").length;
  }

  function getWineListElement() {
    return document.querySelector('.wine-list[fs-list-element="list"], .wine-list.w-dyn-items');
  }

  function setWinesLoadedText(isLoading) {
    const label = document.getElementById("winesLoadedTxt");

    if (!label) {
      return;
    }

    label.textContent = isLoading ? WINES_LOADED_TEXT_LOADING : WINES_LOADED_TEXT_DEFAULT;
  }

  function getPaginationInfo(rootDocument) {
    const scope = rootDocument || document;
    const pageCountText = normalizeText(scope.querySelector(".w-page-count") && scope.querySelector(".w-page-count").textContent);
    const parts = pageCountText.split("/").map(function (part) {
      return normalizeText(part);
    });
    const currentPage = Number.parseInt(parts[0], 10);
    const totalPages = Number.parseInt(parts[1], 10);
    const nextLink = scope.querySelector(".w-pagination-next");

    return {
      currentPage: Number.isFinite(currentPage) ? currentPage : 1,
      totalPages: Number.isFinite(totalPages) ? totalPages : 1,
      nextUrl: nextLink ? new URL(nextLink.getAttribute("href"), window.location.href).toString() : null,
    };
  }

  function finalizeLoadedWinePages() {
    state.allWinePagesLoaded = true;
    pruneEmptyDomains();
    removeUnusedYears();
    collectWineEntries();

    if (typeof state.applyFilters === "function") {
      state.applyFilters();
    } else {
      refreshLastItemBorders();
    }
  }

  async function loadAllWinePagesFallback() {
    if (manualLoadPromise) {
      return manualLoadPromise;
    }

    const wineList = getWineListElement();
    const pagination = getPaginationInfo();

    if (!wineList || pagination.totalPages <= 1 || !pagination.nextUrl || pagination.currentPage >= pagination.totalPages) {
      setWinesLoadedText(false);
      return Promise.resolve();
    }

    manualLoadPromise = (async function () {
      setWinesLoadedText(true);

      const parser = new DOMParser();
      const deferredItems = [];
      const seenSlugs = new Set(
        $$(".wine-item .slug.w-embed")
          .map(function (element) {
            return normalizeText(element.textContent);
          })
          .filter(Boolean),
      );
      const nextPageUrl = new URL(pagination.nextUrl);
      const pageParamName = Array.from(nextPageUrl.searchParams.keys()).find(function (key) {
        return key.endsWith("_page");
      });
      const pageUrls = [];

      for (let pageNumber = pagination.currentPage + 1; pageNumber <= pagination.totalPages; pageNumber += 1) {
        const pageUrl = new URL(window.location.href);
        pageUrl.search = "";
        nextPageUrl.searchParams.forEach(function (value, key) {
          pageUrl.searchParams.set(key, value);
        });

        if (pageParamName) {
          pageUrl.searchParams.set(pageParamName, String(pageNumber));
        }

        pageUrls.push(pageUrl.toString());
      }

      for (let batchStart = 0; batchStart < pageUrls.length; batchStart += FALLBACK_PAGES_PER_BATCH) {
        const batchUrls = pageUrls.slice(batchStart, batchStart + FALLBACK_PAGES_PER_BATCH);

        for (const pageUrl of batchUrls) {
          const response = await window.fetch(pageUrl, {
            credentials: "same-origin",
          });

          if (!response.ok) {
            throw new Error("Failed to fetch " + pageUrl + " (" + response.status + ")");
          }

          const html = await response.text();
          const nextDocument = parser.parseFromString(html, "text/html");
          const nextWineList = nextDocument.querySelector('.wine-list[fs-list-element="list"], .wine-list.w-dyn-items');

          if (!nextWineList) {
            continue;
          }

          $$(".wine-item.w-dyn-item", nextWineList).forEach(function (item) {
            const slug = normalizeText($(".slug.w-embed", item) && $(".slug.w-embed", item).textContent);

            if (!slug || seenSlugs.has(slug)) {
              return;
            }

            seenSlugs.add(slug);

            if (window.__bwcWinesListViewBooted) {
              deferredItems.push(item);
              return;
            }

            wineList.appendChild(item);
          });
        }
      }

      if (window.__bwcWinesListViewBooted && deferredItems.length) {
        await appendWineItemsToBootedDom(deferredItems);
      }

      if (getWineItemCount() >= LOADER_HIDE_AFTER_ITEM_COUNT) {
        await nextFrame();
        hideLoader();
      }
    })();

    return manualLoadPromise;
  }

  async function initializePage() {
    if (window.location.pathname !== PAGE_PATH) {
      return;
    }

    if (window.__bwcWinesListViewBooted) {
      return;
    }

    initLoader();
    boot();
    setWinesLoadedText(false);

    if (getWineItemCount() >= LOADER_HIDE_AFTER_ITEM_COUNT) {
      hideLoader();
    }

    try {
      await loadAllWinePagesFallback();
    } catch (error) {
      console.error("Failed to load all paginated wine items:", error);
    }

    finalizeLoadedWinePages();
    setWinesLoadedText(false);
    hideLoader();
  }

  if (document.readyState === "complete") {
    initializePage();
  } else {
    window.addEventListener("load", initializePage, { once: true });
  }
})();
