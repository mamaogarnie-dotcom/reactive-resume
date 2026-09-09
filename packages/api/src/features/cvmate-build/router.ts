import { crudRouter } from "./crud";

export const cvmateBuildRouter = {
	list: crudRouter.list,
	getById: crudRouter.getById,
	create: crudRouter.create,
	update: crudRouter.update,
	delete: crudRouter.delete,
};
