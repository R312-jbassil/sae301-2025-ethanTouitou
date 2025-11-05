import PocketBase from "pocketbase";

const initLoginForm = () => {
	const form = document.querySelector<HTMLFormElement>("#login-form");
	if (!form) return;

	const statusElement = document.querySelector<HTMLElement>("#login-status");
	const submitButton = form.querySelector<HTMLButtonElement>("button[type='submit']");
	const defaultLabel = submitButton?.querySelector<HTMLElement>("[data-default-label]");
	const loadingLabel = submitButton?.querySelector<HTMLElement>("[data-loading-label]");
	const togglePassword = form.querySelector<HTMLButtonElement>("[data-toggle-password]");
	const passwordField = form.querySelector<HTMLInputElement>("#password");

	const pocketbaseUrl =
		import.meta.env.PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";
	const pb = new PocketBase(pocketbaseUrl);

	const resetStatus = () => {
		if (!statusElement) return;
		statusElement.textContent = "";
		statusElement.classList.remove("text-red-600", "text-green-600");
	};

	const setStatus = (message: string, type: "error" | "success") => {
		if (!statusElement) return;
		statusElement.textContent = message;
		statusElement.classList.toggle("text-red-600", type === "error");
		statusElement.classList.toggle("text-green-600", type === "success");
	};

	togglePassword?.addEventListener("click", () => {
		if (!passwordField) return;
		const isPassword = passwordField.type === "password";
		passwordField.type = isPassword ? "text" : "password";
		togglePassword.textContent = isPassword ? "Masquer" : "Afficher";
		passwordField.focus();
	});

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		resetStatus();

		const identityField = form.querySelector<HTMLInputElement>("#identity");
		const passwordInput = form.querySelector<HTMLInputElement>("#password");

		if (!identityField || !passwordInput) {
			setStatus("Formulaire incomplet. Merci de réessayer.", "error");
			return;
		}

		const identity = identityField.value.trim();
		const password = passwordInput.value;

		if (!identity || !password) {
			setStatus("Merci de renseigner votre email et votre mot de passe.", "error");
			return;
		}

		if (submitButton && defaultLabel && loadingLabel) {
			submitButton.disabled = true;
			defaultLabel.classList.add("hidden");
			loadingLabel.classList.remove("hidden");
		}

		try {
			await pb.collection("users").authWithPassword(identity, password);

			setStatus("Connexion réussie ! Vous êtes redirigé…", "success");

			window.setTimeout(() => {
				window.location.assign("/");
			}, 1200);
		} catch (error: unknown) {
			const fallbackMessage =
				"Impossible de vous connecter. Vérifiez votre email ou votre mot de passe.";
			let detailedMessage = fallbackMessage;

			if (error && typeof error === "object") {
				const errorWithMessage = error as {
					data?: { message?: string };
					message?: string;
				};

				if (
					errorWithMessage.data &&
					typeof errorWithMessage.data.message === "string"
				) {
					detailedMessage = errorWithMessage.data.message;
				} else if (typeof errorWithMessage.message === "string") {
					detailedMessage = errorWithMessage.message;
				}
			}

			console.error("PocketBase login error", error);
			setStatus(detailedMessage, "error");
		} finally {
			if (submitButton && defaultLabel && loadingLabel) {
				submitButton.disabled = false;
				defaultLabel.classList.remove("hidden");
				loadingLabel.classList.add("hidden");
			}
		}
	});
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initLoginForm, { once: true });
} else {
	initLoginForm();
}
