import type PocketBase, { RecordModel, RecordService } from "pocketbase";

export enum Collections {
	Commande = "Commande",
	Compose = "Compose",
	Materiaux = "Materiaux",
	Lunette = "lunette",
	Users = "users",
}

export type IsoDateString = string;

export type BaseSystemFields<T = string> = {
	id: T;
	created: IsoDateString;
	updated: IsoDateString;
	collectionId?: string;
	collectionName?: Collections;
};

export type AuthSystemFields<T = string> = BaseSystemFields<T> & {
	email: string;
	emailVisibility: boolean;
	username?: string;
	verified: boolean;
};

export type ExpandField<T> = {
	expand?: T;
};

export type LunetteResponse<Texpand = unknown> = BaseSystemFields &
	ExpandField<Texpand> &
	RecordModel & {
		code_svg?: string;
		nom?: string;
		largeur_pont?: number;
		taille_verre?: number;
		IdMateriaux?: string;
		IdMateriaux_1?: string;
	};

export type MateriauxResponse<Texpand = unknown> = BaseSystemFields &
	ExpandField<Texpand> &
	RecordModel & {
		label?: string;
		materiau?: string[];
	};

export type ComposeResponse<Texpand = {
	IdUtilisateur?: UsersResponse;
	IdLunette?: LunetteResponse;
}> = BaseSystemFields &
	ExpandField<Texpand> &
	RecordModel & {
		IdUtilisateur?: string;
		IdLunette?: string;
	};

export type CommandeResponse<Texpand = unknown> = BaseSystemFields &
	ExpandField<Texpand> &
	RecordModel & {
		total?: number;
		date_commande?: string;
	};

export type UsersResponse<Texpand = unknown> = AuthSystemFields &
	ExpandField<Texpand> &
	RecordModel & {
		name?: string;
		avatar?: string;
	};

export interface TypedPocketBase extends PocketBase {
	collection(idOrName: Collections.Lunette): RecordService<LunetteResponse>;
	collection(idOrName: Collections.Materiaux): RecordService<MateriauxResponse>;
	collection(idOrName: Collections.Compose): RecordService<ComposeResponse>;
	collection(idOrName: Collections.Commande): RecordService<CommandeResponse>;
	collection(idOrName: Collections.Users): RecordService<UsersResponse>;
	collection(
		idOrName: string
	): RecordService<RecordModel>;
}

