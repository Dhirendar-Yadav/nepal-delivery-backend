import { useCallback, useEffect, useRef } from "react";

const DEFAULT_HISTORY_STATE = Object.freeze({
    type: "app-navigation"
});

export default function useBrowserBackNavigation({
    namespace,
    currentState,
    onBack,
    enabled = true
}) {
    const stateRef = useRef(currentState);
    const onBackRef = useRef(onBack);
    const resetStateRef = useRef(null);

    useEffect(() => {
        stateRef.current = currentState;
    }, [currentState]);

    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

    const createHistoryState = useCallback((
        state,
        boundary = false,
        navigationDepth = 0
    ) => ({
        ...DEFAULT_HISTORY_STATE,
        namespace,
        state,
        boundary,
        navigationDepth
    }), [namespace]);

    const getNavigationDepth = useCallback((historyState) => {
        if (
            historyState?.type !== DEFAULT_HISTORY_STATE.type ||
            historyState?.namespace !== namespace
        ) {
            return 0;
        }

        return Number.isInteger(historyState.navigationDepth) &&
            historyState.navigationDepth >= 0
            ? historyState.navigationDepth
            : 0;
    }, [namespace]);

    const push = useCallback((nextState) => {
        if (!enabled) {
            return;
        }

        const currentHistoryState = window.history.state;
        const currentDepth = getNavigationDepth(
            currentHistoryState
        );

        window.history.pushState(
            createHistoryState(
                nextState,
                false,
                currentDepth + 1
            ),
            "",
            window.location.href
        );
    }, [createHistoryState, enabled, getNavigationDepth]);

    const replace = useCallback((nextState, boundary = false) => {
        if (!enabled) {
            return;
        }

        const currentDepth = boundary
            ? 0
            : getNavigationDepth(window.history.state);

        window.history.replaceState(
            createHistoryState(
                nextState,
                boundary,
                currentDepth
            ),
            "",
            window.location.href
        );
    }, [createHistoryState, enabled, getNavigationDepth]);

    const goBack = useCallback(() => {
        if (!enabled) {
            return;
        }

        window.history.back();
    }, [enabled]);

    const goBackSteps = useCallback((steps = 1) => {
        if (!enabled) {
            return;
        }

        const safeSteps = Number.isInteger(steps)
            ? Math.max(1, steps)
            : 1;

        window.history.go(-safeSteps);
    }, [enabled]);

    const reset = useCallback((nextState) => {
        if (!enabled) {
            return;
        }

        const currentHistoryState = window.history.state;
        const currentDepth = getNavigationDepth(
            currentHistoryState
        );

        if (currentDepth === 0) {
            window.history.replaceState(
                createHistoryState(
                    nextState,
                    true,
                    0
                ),
                "",
                window.location.href
            );

            window.history.pushState(
                createHistoryState(
                    nextState,
                    false,
                    0
                ),
                "",
                window.location.href
            );

            onBackRef.current?.(nextState);
            return;
        }

        resetStateRef.current = nextState;
        window.history.go(-currentDepth);
    }, [
        createHistoryState,
        enabled,
        getNavigationDepth
    ]);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        const existingState =
            window.history.state &&
            typeof window.history.state === "object"
                ? window.history.state
                : null;

        const isExistingNavigationState =
            existingState?.type === DEFAULT_HISTORY_STATE.type &&
            existingState?.namespace === namespace;

        if (!isExistingNavigationState) {
            const boundaryState = {
                ...(existingState || {}),
                ...createHistoryState(
                    stateRef.current,
                    true,
                    0
                )
            };

            window.history.replaceState(
                boundaryState,
                "",
                window.location.href
            );

            window.history.pushState(
                createHistoryState(
                    stateRef.current,
                    false,
                    0
                ),
                "",
                window.location.href
            );
        }

        const handlePopState = (event) => {
            const state = event.state;

            if (resetStateRef.current) {
                const nextState = resetStateRef.current;

                resetStateRef.current = null;

                window.history.replaceState(
                    createHistoryState(
                        nextState,
                        true,
                        0
                    ),
                    "",
                    window.location.href
                );

                window.history.pushState(
                    createHistoryState(
                        nextState,
                        false,
                        0
                    ),
                    "",
                    window.location.href
                );

                onBackRef.current?.(nextState);
                return;
            }

            if (
                state?.type !== DEFAULT_HISTORY_STATE.type ||
                state?.namespace !== namespace
            ) {
                window.history.forward();
                return;
            }

            if (state.boundary) {
                onBackRef.current?.(state.state);
                return;
            }

            onBackRef.current?.(state.state);
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [createHistoryState, enabled, namespace]);

    return {
        push,
        replace,
        goBack,
        goBackSteps,
        reset
    };
}
