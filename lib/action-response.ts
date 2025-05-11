export type ActionResult<T = any> =
  | { success: true; data?: T }
  | { success: false; error: string };

export const actionResponse = {
  success: <T>(data?: T): ActionResult<T> => {
    return { success: true, data };
  },
  error: (message: string): ActionResult<never> => {
    return { success: false, error: message };
  },

  unauthorized: (message = "Unauthorized"): ActionResult<never> => {
    return actionResponse.error(message);
  },
  badRequest: (message = "Bad Request"): ActionResult<never> => {
    return actionResponse.error(message);
  },
  forbidden: (message = "Forbidden"): ActionResult<never> => {
    return actionResponse.error(message);
  },
  notFound: (message = "Not Found"): ActionResult<never> => {
    return actionResponse.error(message);
  },
  conflict: (message = "Conflict"): ActionResult<never> => {
    return actionResponse.error(message);
  },
};
