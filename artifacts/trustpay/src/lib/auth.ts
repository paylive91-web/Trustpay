export const getAuthToken = () => localStorage.getItem("authToken");

export const setAuthToken = (token: string) => {
  localStorage.setItem("authToken", token);
};

export const clearAuthToken = () => {
  localStorage.removeItem("authToken");
};
