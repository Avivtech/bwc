const BWC_VERSION = "v1.1.7";

window.__BWC_VERSION__ = BWC_VERSION;
console.log("[bwc] version", BWC_VERSION);

function runINIT() {
	const config = {
		text: {
			itemInCart: "נמצא בסל", // Hebrew for "In Cart"
			itemNotInCart: "+ הוסף לסל", // Hebrew for "+ Add to Cart"
		},
		classes: {
			items: "add-item",
			itemName: "add-name",
			itemPrice: "add-price",
			itemAddToCart: "add-wine",
			itemInCart: "in-cart",
			itemYear: "add-year",
			itemDomain: "add-domaine",
			itemCat: "wine-cat",
			cartItem: "cart-item",
			cartItemName: "cart-itemname",
			cartItemPrice: "cart-itemprice",
			cartItemInput: "cart-iteminput",
			cartItemAddOneButton: "cart-itemadd",
			cartItemSubtractOneButton: "cart-itemsubtract",
			cartItemQuantity: "cart-itemquantity",
			cartItemDelete: "cart-item-delete",
			cartItemYear: "cart-itemyear",
			cartItemDomain: "cart-itemdomain",
			cartItemCat: "cart-itemcat",
			cartCount: "cart-count",
			cartContainer: "cart-container",
			cartClearItems: "cart-clear",
			cartTotalPrice: "sc-cart-subtotal",
		},
		ids: {
			cartJson: "mainjson",
			successMessage: "success-message-div",
		},
		selectors: {
			cartForm: "#cartForm",
			cartContinue: "#cartCont",
			cartBack: "#cartBack",
			cartEnd: "#cartEnd",
			submitOrderButton: "#submitOrderBtn",
			nameInput: "#name",
			emailInput: "#email",
			phoneInput: "#phone",
			cartNavDots: "#cartNav .w-slider-dot",
			navCount: "#navCount",
			cartButton: "#cart-btn",
			cartCloseButton: "#cart-close-btn",
			inputFields: ".input-field",
		},
		popup: {
			wrapper: ".cart-popup-wrap",
			domaine: ".cart-popup-domaine",
			year: ".cart-popup-year",
			name: ".cart-popup-name",
			add: ".cart-popup-add",
			subtract: ".cart-popup-subtract",
			price: ".cart-itemprice",
			quantityContainer: ".cart-quantity-embed",
			close: ".cart-popup-close",
			cat: ".cart-popup-cat",
		},
		popupDurationMs: 3000,
		popupFadeDurationMs: 500,
		popupTickMs: 16,
		totalPriceBeforeText: "",
		totalPriceAfterText: "",
	};

	const elements = {
		cartCount: null,
		cartContainer: null,
		cartTotalPrice: null,
		cartJson: null,
		sampleCartItem: null,
		clearButtons: [],
		flow: {
			cartForm: null,
			cartContinue: null,
			cartBack: null,
			cartEnd: null,
			submitOrderButton: null,
			nameInput: null,
			emailInput: null,
			phoneInput: null,
			cartNavDots: [],
			navCount: null,
			cartButton: null,
			cartCloseButton: null,
			inputFields: [],
		},
		popup: {
			wrapper: null,
			domaine: null,
			year: null,
			name: null,
			add: null,
			subtract: null,
			price: null,
			quantity: null,
			closeButtons: [],
			cat: null,
		},
	};

	const state = {
		cart: createEmptyCart(),
		registry: {},
		cartRows: {},
		current: {
			name: null,
			currentHover: false,
			leftDuration: config.popupDurationMs,
		},
		ui: {
			navPulseTimeoutId: null,
		},
	};

	removeEmptyBindings();
	state.cart = loadCart();
	cacheFlowElements();
	bindFlowEvents();
	syncFlowState(true);
	if (cacheElements() === false) {
		return;
	}
	bindListingItems();
	bindClearButtons();
	bindSuccessMessageObserver();
	cachePopupElements();
	bindPopupEvents();
	renderCart();
	syncListingButtons();
	startPopupController();
	window.__bwcRegisterCartListingItems = bindListingItems;

	function removeEmptyBindings() {
		document.querySelectorAll(".w-condition-invisible.w-dyn-bind-empty").forEach((element) => element.remove());
	}

	function createEmptyCart() {
		return {
			items: {},
		};
	}

	function buildCartString(name, cat, year, domain) {
		return name + "|" + cat + "|" + year + "|" + domain + "|" + "<updated-ver-2>";
	}

	function parsePrice(value) {
		const normalizedValue = String(value)
			.trim()
			.replace(/\s+/g, "")
			.replace(/[^0-9.,-]/g, "");
		const lastCommaIndex = normalizedValue.lastIndexOf(",");
		const lastDotIndex = normalizedValue.lastIndexOf(".");
		const decimalSeparatorIndex = Math.max(lastCommaIndex, lastDotIndex);
		let wholePart = normalizedValue;
		let decimalPart = "";

		if (decimalSeparatorIndex !== -1) {
			const candidateDecimalPart = normalizedValue.slice(decimalSeparatorIndex + 1);
			if (candidateDecimalPart.length > 0 && candidateDecimalPart.length <= 2) {
				wholePart = normalizedValue.slice(0, decimalSeparatorIndex);
				decimalPart = candidateDecimalPart;
			}
		}

		const parsedValue = Number.parseFloat(wholePart.replace(/[.,]/g, "") + (decimalPart === "" ? "" : `.${decimalPart}`));
		return Number.isFinite(parsedValue) ? parsedValue : 0;
	}

	function validateQuantity(amount) {
		const parsedAmount = Number.parseInt(amount, 10);
		if (Number.isFinite(parsedAmount) === false) {
			return 1;
		}

		return Math.max(parsedAmount, 1);
	}

	function createCartItemData(data) {
		return {
			name: String(data.name || ""),
			price: parsePrice(data.price),
			quantity: validateQuantity(data.quantity),
			year: String(data.year || ""),
			domain: String(data.domain || ""),
			cat: String(data.cat || ""),
		};
	}

	function getCartItem(itemName) {
		return state.cart.items[itemName];
	}

	function serializeCartItems() {
		return Object.values(state.cart.items).map((item) => ({
			name: item.name,
			price: item.price,
			quantity: item.quantity,
			year: item.year,
			domain: item.domain,
			cat: item.cat,
		}));
	}

	function saveCart() {
		localStorage.setItem("cart", JSON.stringify({ items: state.cart.items }));
	}

	function loadCart() {
		const storage = localStorage.getItem("cart");
		if (storage === null || storage === "null") {
			return createEmptyCart();
		}

		let parsedCart;
		try {
			parsedCart = JSON.parse(storage);
		} catch (error) {
			console.error("failed to parse cart storage", error);
			return createEmptyCart();
		}

		if (parsedCart === null || typeof parsedCart !== "object") {
			return createEmptyCart();
		}

		const normalizedCart = createEmptyCart();
		const items = parsedCart.items;
		if (items === null || typeof items !== "object") {
			return normalizedCart;
		}

		Object.entries(items).forEach(([storedKey, rawItem]) => {
			if (rawItem === null || typeof rawItem !== "object") {
				return;
			}

			const cartItem = createCartItemData(rawItem);
			const itemKey = storedKey.includes("<updated-ver-2>") ? storedKey : buildCartString(cartItem.name, cartItem.cat, cartItem.year, cartItem.domain);

			normalizedCart.items[itemKey] = cartItem;
		});

		return normalizedCart;
	}

	function getRequiredElement(selector, errorMessage) {
		const element = document.querySelector(selector);
		if (element === null) {
			console.error(errorMessage);
			return null;
		}

		return element;
	}

	function cacheElements() {
		elements.sampleCartItem = getRequiredElement(`.${config.classes.cartItem}`, "sampleCart Not found");
		if (elements.sampleCartItem === null) {
			return false;
		}

		const templateContainer = document.createElement("div");
		templateContainer.appendChild(elements.sampleCartItem);

		elements.cartCount = getRequiredElement(`.${config.classes.cartCount}`, "config.cartCount Not found");
		elements.cartTotalPrice = getRequiredElement(`.${config.classes.cartTotalPrice}`, "config.cartTotalPrice.element Not found");
		elements.cartContainer = getRequiredElement(`.${config.classes.cartContainer}`, "config.cartContainer Not found");
		elements.cartJson = document.getElementById(config.ids.cartJson);
		if (elements.cartJson === null) {
			console.error("config.cartJsonId Not found");
			return false;
		}

		elements.clearButtons = Array.from(document.querySelectorAll(`.${config.classes.cartClearItems}`));

		return elements.cartCount !== null && elements.cartTotalPrice !== null && elements.cartContainer !== null && elements.cartJson !== null;
	}

	function cacheFlowElements() {
		elements.flow.cartForm = document.querySelector(config.selectors.cartForm);
		elements.flow.cartContinue = document.querySelector(config.selectors.cartContinue);
		elements.flow.cartBack = document.querySelector(config.selectors.cartBack);
		elements.flow.cartEnd = document.querySelector(config.selectors.cartEnd);
		elements.flow.submitOrderButton = document.querySelector(config.selectors.submitOrderButton);
		elements.flow.nameInput = document.querySelector(config.selectors.nameInput);
		elements.flow.emailInput = document.querySelector(config.selectors.emailInput);
		elements.flow.phoneInput = document.querySelector(config.selectors.phoneInput);
		elements.flow.cartNavDots = Array.from(document.querySelectorAll(config.selectors.cartNavDots));
		elements.flow.navCount = document.querySelector(config.selectors.navCount);
		elements.flow.cartButton = document.querySelector(config.selectors.cartButton);
		elements.flow.cartCloseButton = document.querySelector(config.selectors.cartCloseButton);
		elements.flow.inputFields = Array.from(document.querySelectorAll(config.selectors.inputFields));
	}

	function goToCartStep(stepIndex) {
		const targetDot = elements.flow.cartNavDots[stepIndex - 1];
		if (targetDot !== undefined) {
			targetDot.click();
		}
	}

	function clearNavPulseTimeout() {
		if (state.ui.navPulseTimeoutId !== null) {
			clearTimeout(state.ui.navPulseTimeoutId);
			state.ui.navPulseTimeoutId = null;
		}
	}

	function removeNavPulse() {
		clearNavPulseTimeout();
		if (elements.flow.navCount !== null) {
			elements.flow.navCount.classList.remove("pulse");
		}
	}

	function pulseNavCount() {
		if (elements.flow.navCount === null) {
			return;
		}

		clearNavPulseTimeout();
		elements.flow.navCount.classList.add("pulse");
		state.ui.navPulseTimeoutId = setTimeout(() => {
			if (elements.flow.navCount !== null) {
				elements.flow.navCount.classList.remove("pulse");
			}
			state.ui.navPulseTimeoutId = null;
		}, 10000);
	}

	function syncInputFieldError(inputField) {
		if (inputField === null) {
			return;
		}

		const errorElement = inputField.nextElementSibling;
		if (errorElement === null) {
			return;
		}

		errorElement.style.display = inputField.value.trim() === "" ? "block" : "none";
	}

	function getHasCartItems() {
		return Object.keys(state.cart.items).length > 0;
	}

	function syncFlowState(shouldPulseOnLoad) {
		const hasCartItems = getHasCartItems();
		const isNameFilled = elements.flow.nameInput !== null && elements.flow.nameInput.value.trim() !== "";
		const isEmailFilled = elements.flow.emailInput !== null && elements.flow.emailInput.value.trim() !== "";
		const isPhoneFilled = elements.flow.phoneInput !== null && elements.flow.phoneInput.value.trim() !== "";

		if (elements.flow.submitOrderButton !== null) {
			elements.flow.submitOrderButton.disabled = !(isNameFilled && isEmailFilled && isPhoneFilled && hasCartItems);
		}

		if (shouldPulseOnLoad === true) {
			if (hasCartItems) {
				pulseNavCount();
			} else {
				removeNavPulse();
			}
			return;
		}

		if (hasCartItems === false) {
			removeNavPulse();
		}
	}

	function resetCartAfterSubmit() {
		localStorage.setItem("cart", JSON.stringify(createEmptyCart()));
		removeNavPulse();
	}

	function bindFlowEvents() {
		if (elements.flow.cartContinue !== null) {
			elements.flow.cartContinue.addEventListener("click", (event) => {
				event.preventDefault();
				goToCartStep(2);
			});
		}

		if (elements.flow.cartBack !== null) {
			elements.flow.cartBack.addEventListener("click", (event) => {
				event.preventDefault();
				goToCartStep(1);
			});
		}

		if (elements.flow.cartEnd !== null) {
			elements.flow.cartEnd.addEventListener("click", (event) => {
				event.preventDefault();
				if (elements.flow.cartCloseButton !== null) {
					elements.flow.cartCloseButton.click();
				}
				window.location.reload();
			});
		}

		elements.flow.inputFields.forEach((inputField) => {
			syncInputFieldError(inputField);
			inputField.addEventListener("blur", () => {
				syncInputFieldError(inputField);
			});
			inputField.addEventListener("input", () => {
				syncInputFieldError(inputField);
				syncFlowState(false);
			});
		});

		if (elements.flow.cartForm !== null) {
			elements.flow.cartForm.addEventListener("submit", () => {
				syncFlowState(false);
				goToCartStep(3);
				resetCartAfterSubmit();
			});
		}

		if (elements.flow.cartButton !== null) {
			elements.flow.cartButton.addEventListener("click", () => {
				removeNavPulse();
			});
		}
	}

	function extractListingItem(itemContainer) {
		const nameElement = itemContainer.querySelector(`.${config.classes.itemName}`);
		const priceElement = itemContainer.querySelector(`.${config.classes.itemPrice}`);
		const addButton = itemContainer.querySelector(`.${config.classes.itemAddToCart}`);
		const yearElement = itemContainer.querySelector(`.${config.classes.itemYear}`);
		const domainElement = itemContainer.querySelector(`.${config.classes.itemDomain}`);
		const catElement = itemContainer.querySelector(`.${config.classes.itemCat}`);

		if (nameElement === null || priceElement === null || addButton === null || yearElement === null || domainElement === null || catElement === null) {
			console.error("listing item is missing one or more required fields", itemContainer);
			return null;
		}

		return {
			itemName: nameElement.textContent,
			itemPrice: priceElement.textContent,
			itemAddToCart: addButton,
			itemYear: yearElement.textContent,
			itemDomain: domainElement.textContent,
			itemCat: catElement.textContent,
		};
	}

	function bindListingItems(root) {
		const scope = root instanceof Element ? root : document;
		const listingItems = scope.querySelectorAll(`.${config.classes.items}`);
		listingItems.forEach((itemContainer) => {
			if (itemContainer.dataset.bwcCartBound === "true") {
				return;
			}

			const item = extractListingItem(itemContainer);
			if (item === null) {
				return;
			}

			const itemKey = buildCartString(item.itemName, item.itemCat, item.itemYear, item.itemDomain);

			state.registry[itemKey] = item;
			item.itemAddToCart.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				addCartItem(itemKey, item);
			});
			itemContainer.dataset.bwcCartBound = "true";
			setListingButtonState(itemKey, getCartItem(itemKey) !== undefined);
		});
	}

	function bindClearButtons() {
		elements.clearButtons.forEach((button) => {
			button.addEventListener("click", clearCart);
		});
	}

	function bindSuccessMessageObserver() {
		const successMessage = document.getElementById(config.ids.successMessage);
		if (successMessage === null) {
			return;
		}

		const observer = new MutationObserver(() => {
			if (successMessage.style.display === "block") {
				clearCart();
			}
		});
		observer.observe(successMessage, { attributes: true, childList: true });
	}

	function cachePopupElements() {
		elements.popup.wrapper = document.querySelector(config.popup.wrapper);
		elements.popup.domaine = document.querySelector(config.popup.domaine);
		elements.popup.year = document.querySelector(config.popup.year);
		elements.popup.name = document.querySelector(config.popup.name);
		elements.popup.add = document.querySelector(config.popup.add);
		elements.popup.subtract = document.querySelector(config.popup.subtract);
		elements.popup.price = document.querySelector(config.popup.price);
		elements.popup.cat = document.querySelector(config.popup.cat);
		elements.popup.closeButtons = Array.from(document.querySelectorAll(config.popup.close));

		const quantityContainer = document.querySelector(config.popup.quantityContainer);
		elements.popup.quantity = quantityContainer !== null && quantityContainer.children.length > 0 ? quantityContainer.children[0] : null;
	}

	function hasCartPopup() {
		return (
			elements.popup.wrapper !== null && elements.popup.domaine !== null && elements.popup.year !== null && elements.popup.name !== null && elements.popup.add !== null && elements.popup.subtract !== null && elements.popup.price !== null && elements.popup.quantity !== null && elements.popup.cat !== null
		);
	}

	function bindPopupEvents() {
		if (hasCartPopup() === false) {
			return;
		}

		elements.popup.quantity.addEventListener("input", (event) => {
			if (state.current.name === null) {
				return;
			}

			setCartItemQuantity(state.current.name, event.target.value);
		});
		elements.popup.add.addEventListener("click", () => {
			if (state.current.name !== null) {
				addCartItemQuantityOne(state.current.name);
			}
		});
		elements.popup.subtract.addEventListener("click", () => {
			if (state.current.name !== null) {
				subtractCartItemQuantityOne(state.current.name);
			}
		});
		elements.popup.closeButtons.forEach((button) => {
			button.addEventListener("click", closePopup);
		});
		elements.popup.wrapper.addEventListener("mouseenter", () => {
			state.current.currentHover = true;
		});
		elements.popup.wrapper.addEventListener("mouseleave", () => {
			state.current.currentHover = false;
		});
	}

	function renderCart() {
		renderCartItems();
		renderCartSummary();
	}

	function renderCartItems() {
		elements.cartContainer.innerHTML = "";
		state.cartRows = {};

		Object.entries(state.cart.items).forEach(([itemKey, cartItem]) => {
			renderCartItem(itemKey, cartItem);
		});
	}

	function renderCartItem(itemKey, cartItem) {
		const cartDomElement = elements.cartContainer.appendChild(elements.sampleCartItem.cloneNode(true));
		const row = {
			element: cartDomElement,
			name: cartDomElement.querySelector(`.${config.classes.cartItemName}`),
			price: cartDomElement.querySelector(`.${config.classes.cartItemPrice}`),
			quantity: cartDomElement.querySelector(`.${config.classes.cartItemQuantity}`),
			input: cartDomElement.querySelector(`.${config.classes.cartItemInput}`),
			year: cartDomElement.querySelector(`.${config.classes.cartItemYear}`),
			domain: cartDomElement.querySelector(`.${config.classes.cartItemDomain}`),
			cat: cartDomElement.querySelector(`.${config.classes.cartItemCat}`),
			addButton: cartDomElement.querySelector(`.${config.classes.cartItemAddOneButton}`),
			subtractButton: cartDomElement.querySelector(`.${config.classes.cartItemSubtractOneButton}`),
			deleteButton: cartDomElement.querySelector(`.${config.classes.cartItemDelete}`),
		};

		if (row.name === null || row.price === null || row.quantity === null || row.input === null || row.year === null || row.domain === null || row.cat === null || row.addButton === null || row.subtractButton === null || row.deleteButton === null) {
			console.error("cart item template is missing one or more required fields");
			cartDomElement.remove();
			return;
		}

		row.name.textContent = cartItem.name;
		row.price.textContent = cartItem.price;
		row.year.textContent = cartItem.year;
		row.domain.textContent = cartItem.domain;
		row.cat.textContent = cartItem.cat;
		row.input.setAttribute("name", "ignore");
		row.input.setAttribute("id", "ignore");
		row.addButton.addEventListener("click", () => addCartItemQuantityOne(itemKey));
		row.subtractButton.addEventListener("click", () => subtractCartItemQuantityOne(itemKey));
		row.deleteButton.addEventListener("click", () => removeCartItem(itemKey));
		row.input.addEventListener("input", (event) => {
			setCartItemQuantity(itemKey, event.target.value);
		});

		state.cartRows[itemKey] = row;
		updateCartRow(itemKey);
	}

	function updateCartRow(itemKey) {
		const row = state.cartRows[itemKey];
		const cartItem = getCartItem(itemKey);
		if (row === undefined || cartItem === undefined) {
			return;
		}

		row.quantity.textContent = cartItem.quantity;
		row.input.value = cartItem.quantity;
	}

	function renderCartSummary() {
		saveCart();
		elements.cartCount.textContent = getAmountText();
		elements.cartTotalPrice.textContent =
			config.totalPriceBeforeText + formatPrice(calculateTotalPrice()) + config.totalPriceAfterText;
		elements.cartJson.value = JSON.stringify(serializeCartItems());
		updatePopupAmount();
		syncFlowState(false);
	}

	function formatPrice(price) {
		const roundedPrice = Math.round(Number(price) * 100) / 100;
		const parts = roundedPrice.toFixed(2).split(".");

		parts[0] = parts[0].replace(/(\d)(?=(\d{3})+$)/g, "$1 ");

		return parts[1] === "00" ? parts[0] : parts.join(".");
	}

	function calculateTotalPrice() {
		const totalPrice = Object.values(state.cart.items).reduce((totalPrice, item) => {
			return totalPrice + item.price * item.quantity;
		}, 0);

		return Math.round(totalPrice * 100) / 100;
	}

	function getItemAmount() {
		return Object.values(state.cart.items).reduce((itemAmount, item) => {
			return itemAmount + item.quantity;
		}, 0);
	}

	function getAmountText() {
		const amount = getItemAmount();
		if (amount > 9) {
			return "+9";
		}

		return amount;
	}

	function setListingButtonState(itemKey, isInCart) {
		const listingItem = state.registry[itemKey];
		if (listingItem === undefined) {
			return;
		}

		listingItem.itemAddToCart.textContent = isInCart ? config.text.itemInCart : config.text.itemNotInCart;
		listingItem.itemAddToCart.classList.toggle(config.classes.itemInCart, isInCart);
	}

	function syncListingButtons() {
		Object.keys(state.registry).forEach((itemKey) => {
			setListingButtonState(itemKey, getCartItem(itemKey) !== undefined);
		});
	}

	function addCartItem(itemKey, listingItem) {
		if (getCartItem(itemKey) === undefined) {
			state.cart.items[itemKey] = createCartItemData({
				name: listingItem.itemName,
				price: listingItem.itemPrice,
				quantity: 1,
				year: listingItem.itemYear,
				domain: listingItem.itemDomain,
				cat: listingItem.itemCat,
			});
			renderCartItem(itemKey, state.cart.items[itemKey]);
			renderCartSummary();
			setListingButtonState(itemKey, true);
			showPopup(itemKey);
			return;
		}

		addCartItemQuantityOne(itemKey);
	}

	function setCartItemQuantity(itemKey, quantity) {
		const cartItem = getCartItem(itemKey);
		if (cartItem === undefined) {
			return;
		}

		cartItem.quantity = validateQuantity(quantity);
		updateCartRow(itemKey);
		renderCartSummary();
	}

	function addCartItemQuantityOne(itemKey) {
		const cartItem = getCartItem(itemKey);
		if (cartItem === undefined) {
			return;
		}

		cartItem.quantity = validateQuantity(cartItem.quantity + 1);
		updateCartRow(itemKey);
		renderCartSummary();
	}

	function subtractCartItemQuantityOne(itemKey) {
		const cartItem = getCartItem(itemKey);
		if (cartItem === undefined) {
			return;
		}

		cartItem.quantity = validateQuantity(cartItem.quantity - 1);
		updateCartRow(itemKey);
		renderCartSummary();
	}

	function removeCartItem(itemKey) {
		const row = state.cartRows[itemKey];
		if (row !== undefined) {
			row.element.remove();
			delete state.cartRows[itemKey];
		}

		delete state.cart.items[itemKey];
		setListingButtonState(itemKey, false);

		if (state.current.name === itemKey) {
			resetPopupState();
		}

		renderCartSummary();
	}

	function clearCart() {
		elements.cartContainer.innerHTML = "";
		state.cartRows = {};
		state.cart = createEmptyCart();
		resetPopupState();
		syncListingButtons();
		renderCartSummary();
	}

	function showPopup(itemKey) {
		if (hasCartPopup() === false) {
			return;
		}

		const listingItem = state.registry[itemKey];
		const cartItem = getCartItem(itemKey);
		if (listingItem === undefined || cartItem === undefined) {
			return;
		}

		state.current.name = itemKey;
		state.current.currentHover = false;
		state.current.leftDuration = config.popupDurationMs;
		elements.popup.domaine.textContent = listingItem.itemDomain;
		elements.popup.name.textContent = listingItem.itemName;
		elements.popup.year.textContent = listingItem.itemYear;
		elements.popup.price.textContent = listingItem.itemPrice;
		elements.popup.cat.textContent = listingItem.itemCat;
		updatePopupAmount();
	}

	function updatePopupAmount() {
		if (hasCartPopup() === false || state.current.name === null) {
			return;
		}

		const cartItem = getCartItem(state.current.name);
		if (cartItem === undefined) {
			return;
		}

		elements.popup.quantity.value = cartItem.quantity;
	}

	function closePopup() {
		state.current.leftDuration = config.popupFadeDurationMs;
	}

	function resetPopupState() {
		state.current.name = null;
		state.current.currentHover = false;
		state.current.leftDuration = config.popupDurationMs;

		if (hasCartPopup()) {
			elements.popup.wrapper.style.opacity = 0;
			elements.popup.wrapper.style.display = "none";
		}

		elements.cartCount.classList.remove("popup-active");
	}

	function startPopupController() {
		setInterval(() => {
			if (state.current.name === null) {
				return;
			}

			if (hasCartPopup() === false || getCartItem(state.current.name) === undefined) {
				resetPopupState();
				return;
			}

			if (state.current.leftDuration <= 0) {
				elements.popup.wrapper.style.opacity = 0;
				elements.popup.wrapper.style.display = "none";
			} else if (state.current.leftDuration < config.popupFadeDurationMs) {
				elements.popup.wrapper.style.opacity = state.current.leftDuration / config.popupFadeDurationMs;
			} else {
				elements.popup.wrapper.style.opacity = 1;
				elements.popup.wrapper.style.display = "block";
			}

			if (elements.cartCount.classList.contains("popup-active") === false) {
				elements.cartCount.classList.add("popup-active");
			}

			state.current.leftDuration -= config.popupTickMs;
			if (state.current.currentHover === true && state.current.leftDuration > config.popupFadeDurationMs) {
				state.current.leftDuration += config.popupTickMs;
			}

			if (state.current.leftDuration <= -config.popupTickMs) {
				resetPopupState();
				renderCartSummary();
			}
		}, config.popupTickMs);
	}
}

if (typeof waitINIT === "undefined" || waitINIT !== true) {
	runINIT();
}
