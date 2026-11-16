// @vitest-environment jsdom
import { createElement, useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../src/components/AuthProvider";
import { authApi, removeAuthToken, setAuthToken, type User } from "../src/lib/api";

let auth: ReturnType<typeof useAuth>;
function Consumer() { const value = useAuth(); useEffect(() => { auth = value; }, [value]); return null; }
const firstUser: User = { id: "first", email: "first@example.com", full_name: "First", created_at: "2026-01-01" };
const secondUser: User = { id: "second", email: "second@example.com", full_name: "Second", created_at: "2026-01-01" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => { localStorage.clear(); removeAuthToken(); });
afterEach(() => { cleanup(); removeAuthToken(); vi.restoreAllMocks(); });

describe("authentication request races", () => {
  it("does not request a profile without a saved token", async () => {
    const getMe = vi.spyOn(authApi, "getMe");
    await act(async () => { render(createElement(AuthProvider, null, createElement(Consumer))); });
    expect(getMe).not.toHaveBeenCalled();
    expect(auth.isLoading).toBe(false);
    expect(auth.user).toBeNull();
  });

  it("ignores a failed session check that arrives after logout", async () => {
    const oldRequest = deferred<User>();
    vi.spyOn(authApi, "getMe").mockReturnValueOnce(oldRequest.promise);
    setAuthToken("old-token");
    await act(async () => { render(createElement(AuthProvider, null, createElement(Consumer))); });
    act(() => { auth.logout(); });
    await act(async () => { oldRequest.reject(new Error("Previous session network failure")); });
    expect(auth.user).toBeNull();
    expect(auth.error).toBeNull();
    expect(auth.isLoading).toBe(false);
  });

  it("clears the previous account while resolving a newly signed-in account", async () => {
    const newRequest = deferred<User>();
    vi.spyOn(authApi, "getMe").mockResolvedValueOnce(firstUser).mockReturnValueOnce(newRequest.promise);
    setAuthToken("first-token");
    await act(async () => { render(createElement(AuthProvider, null, createElement(Consumer))); });
    expect(auth.user?.id).toBe("first");
    let login!: Promise<boolean>;
    act(() => { login = auth.login("second-token"); });
    expect(auth.user).toBeNull();
    expect(auth.isLoading).toBe(true);
    await act(async () => { newRequest.resolve(secondUser); await login; });
    expect(auth.user?.id).toBe("second");
    expect(auth.isLoading).toBe(false);
  });

  it("does not let an old failure replace a directly supplied new account", async () => {
    const oldRequest = deferred<User>();
    vi.spyOn(authApi, "getMe").mockReturnValueOnce(oldRequest.promise);
    setAuthToken("old-token");
    await act(async () => { render(createElement(AuthProvider, null, createElement(Consumer))); });
    await act(async () => { await auth.login("new-token", secondUser); });
    await act(async () => { oldRequest.reject(new Error("Old request failed")); });
    expect(auth.user?.id).toBe("second");
    expect(auth.error).toBeNull();
    expect(auth.isLoading).toBe(false);
  });

  it("invalidates an old request even when a later login receives the same token", async () => {
    const oldRequest = deferred<User>();
    const newRequest = deferred<User>();
    vi.spyOn(authApi, "getMe").mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    setAuthToken("same-token");
    await act(async () => { render(createElement(AuthProvider, null, createElement(Consumer))); });
    let login!: Promise<boolean>;
    act(() => { login = auth.login("same-token"); });
    await act(async () => { oldRequest.resolve(firstUser); });
    expect(auth.user).toBeNull();
    expect(auth.isLoading).toBe(true);
    await act(async () => { newRequest.resolve(secondUser); await login; });
    expect(auth.user?.id).toBe("second");
  });
});
