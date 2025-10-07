module.exports = extend;

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend(target) {
    if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
    }

    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        if (source == null) {
            continue;
        }

        for (var key in source) {
            if (!hasOwnProperty.call(source, key)) {
                continue;
            }

            var descriptor = Object.getOwnPropertyDescriptor(target, key);
            if (descriptor && 'writable' in descriptor && descriptor.writable === false) {
                continue;
            }

            try {
                target[key] = source[key];
            } catch (err) {
                if (descriptor && 'writable' in descriptor && descriptor.writable === false) {
                    continue;
                }
                if (!Object.isExtensible(target) && !hasOwnProperty.call(target, key)) {
                    continue;
                }
                throw err;
            }
        }
    }

    return target;
}
