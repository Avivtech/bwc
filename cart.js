function runINIT() {
	const config = {
		text: {
			itemInCart: "× ×ž×¦× ×‘×¡×œ",
			itemNotInCart: "+ ×”×•×¡×£ ×œ×¡×œ",
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
	};

	removeEmptyBindings();
	if (cacheElements() === false) {
		return;
	}

	state.cart = loadCart();
	bindListingItems();
	bindClearButtons();
	bindSuccessMessageObserver();
	cachePopupElements();
	bindPopupEvents();
	renderCart();
	syncListingButtons();
	startPopupController();

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
			alert("config.cartJsonId Not found");
			return false;
		}

		elements.clearButtons = Array.from(document.querySelectorAll(`.${config.classes.cartClearItems}`));

		return elements.cartCount !== null && elements.cartTotalPrice !== null && elements.cartContainer !== null && elements.cartJson !== null;
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

	function bindListingItems() {
		const listingItems = document.querySelectorAll(`.${config.classes.items}`);
		listingItems.forEach((itemContainer) => {
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
		elements.cartTotalPrice.textContent = config.totalPriceBeforeText + calculateTotalPrice() + config.totalPriceAfterText;
		elements.cartJson.value = JSON.stringify(serializeCartItems());
		updatePopupAmount();
	}

	function calculateTotalPrice() {
		return Object.values(state.cart.items).reduce((totalPrice, item) => {
			return totalPrice + item.price * item.quantity;
		}, 0);
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
