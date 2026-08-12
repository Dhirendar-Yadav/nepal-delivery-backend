export const toggleSelection = (item, setState) => {
    setState((prev) =>
        prev.includes(item)
            ? prev.filter((x) => x !== item)
            : [...prev, item]
    );
};