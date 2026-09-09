import { crudRouter } from "./crud";

export const cvmateBuildRouter = {
	list: crudRouter.list,
	getById: crudRouter.getById,
	create: crudRouter.create,
	update: crudRouter.update,
	delete: crudRouter.delete,
	listSelectionItems: crudRouter.listSelectionItems,
	createSelectionItem: crudRouter.createSelectionItem,
	updateSelectionItem: crudRouter.updateSelectionItem,
	deleteSelectionItem: crudRouter.deleteSelectionItem,
};
