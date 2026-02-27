(function(target) {
// This is a js one liner to paste into the chrome dev tools console for detecting the player api.
// Will recursively traverse a <div> and its children and find all the methods that are not part of the default div api
// Just click 'Store as a global variable and paste this into the console.
    const cleanElem = document.createElement('div');
    const defaultProps = new Set();

    // 1. Map all standard properties/methods from a fresh div
    let proto = cleanElem;
    while (proto) {
        Object.getOwnPropertyNames(proto).forEach(prop => defaultProps.add(prop));
        proto = Object.getPrototypeOf(proto);
    }

    // 2. Recursive function to find custom methods
    function findCustomMethods(obj, path = 'root', visited = new Set()) {
        if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
        visited.add(obj);

        for (const key in obj) {
            try {
                const value = obj[key];
                
                // If it's a function and NOT in our default set, log it
                if (typeof value === 'function' && !defaultProps.has(key)) {
                    console.log(`[Method] ${path}.${key}`);
                }

                // Recursively check sub-objects (ignoring standard DOM properties)
                if (value && typeof value === 'object' && !defaultProps.has(key)) {
                    findCustomMethods(value, `${path}.${key}`, visited);
                }
            } catch (e) {
                // Some properties might throw security errors (like cross-origin)
            }
        }
    }

    console.log("--- Custom Methods Found ---");
    findCustomMethods(target);
})(temp1);
