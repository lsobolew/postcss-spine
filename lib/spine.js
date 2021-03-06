var postcss = require("postcss");
var extend = require("extend");
var csscolors = require('css-color-names');

module.exports = postcss.plugin("postcss-spine", function (opts) {
    var defaultOpts = {
        fallback: false,
        complementary: false,
    };
    var opts = extend({}, defaultOpts, opts || {});

    var paintProperties = [
        "background-attachment",
        "background-blend-mode",
        "background-clip",
        "background-color",
        "background-image",
        "background-origin",
        "background-position",
        "background-position-x",
        "background-position-y",
        "background-repeat",
        "background-repeat-x",
        "background-repeat-y",
        "background-size",
        "background",

        "border-bottom-left-radius",
		"border-bottom-right-radius",
		"border-top-left-radius",
		"border-top-right-radius",
		"border-radius",

        "border-bottom-color",
        "border-left-color",
        "border-right-color",
        "border-top-color",
        "border-color",

		"border-bottom-style",
		"border-left-style",
		"border-right-style",
		"border-top-style",
		"border-style",

		"border-image-outset",
		"border-image-repeat",
		"border-image-slice",
		"border-image-source",
		"border-image-width",

        "border",
        
        "box-shadow",
        "color",
        "outline-offset",
        "text-shadow"
    ];

    var visibilityProperties = [
        "clip",
        "backface-visibility",
        "transform",
        "transform-origin",
        "transform-style",
        "z-index",
        "opacity",
        "perspective",
        "perspective-origin"
    ];

    var returnFunctions = {
        "border": function(decl) {
            decl.value = decl.value.match(/[^\s]+\([^\)]*\)|[^\s]+/g).filter(function(v){
                if (v.indexOf("#") == 0 || v.indexOf("rgb") == 0 || v.indexOf("hsl") == 0 || v.indexOf("rbga") == 0) {
                    return false;
                }
                if (typeof csscolors[v.toLowerCase()] !== 'undefined') {
                    return false;
                }
                return true;
            }).join(" ");
        },
        "background": function(decl) {
            if(opts.fallback === true) {
                decl.value = "#fff";
            } else {
                decl.removeSelf();
            }
        },
        "background-color": function(decl) {
            if(opts.fallback === true) {
                decl.value = "#fff";
            } else {
                decl.removeSelf();
            }
        },
        "animation": function(decl) {
            decl.removeSelf();
        },
        "transition": function(decl) {
            decl.removeSelf();
        }
    };

    var complementaryReturnFunctions = {
        "border": function(decl) {
            decl.value = decl.value.match(/[^\s]+\([^\)]*\)|[^\s]+/g).filter(function(v){
                if (v.indexOf("#") == 0 || v.indexOf("rgb") == 0 || v.indexOf("hsl") == 0 || v.indexOf("rgba") == 0) {
                    return true;
                }
                if (typeof csscolors[v.toLowerCase()] !== 'undefined') {
                    return true;
                }
                return false;
            }).join(" ");

            decl.prop = "border-color";
        },
        "background": function(decl) {
            
        },
        "background-color": function(decl) {

        },
        "animation": function(decl) {

        },
        "transition": function(decl) {

        }
    };


    if(opts.complementary === true) {
        return function (css) {
            css.eachDecl(function (decl) {
                var unprefixedProp = postcss.vendor.unprefixed(decl.prop);

                if(/animation/.test(unprefixedProp)) {
                    complementaryReturnFunctions['animation'](decl);
                }

                if(/transition/.test(unprefixedProp)) {
                    complementaryReturnFunctions['transition'](decl);
                }

                if (typeof(complementaryReturnFunctions[unprefixedProp]) === 'function') {
                    complementaryReturnFunctions[unprefixedProp](decl);
                } else if (visibilityProperties.indexOf(unprefixedProp) != -1) {
                    if(opts.fallback === true) {
                        decl.removeSelf();
                    }
                } else if (paintProperties.indexOf(unprefixedProp) == -1) {
                    decl.removeSelf();   
                }
            });
        };
    } else {
        return function (css) {
            css.eachDecl(function (decl) {
                var unprefixedProp = postcss.vendor.unprefixed(decl.prop);

                if(/animation/.test(unprefixedProp)) {
                    returnFunctions['animation'](decl);
                }

                if(/transition/.test(unprefixedProp)) {
                    returnFunctions['transition'](decl);
                }

                if (typeof(returnFunctions[unprefixedProp]) === 'function') {
                    returnFunctions[unprefixedProp](decl);
                } else if (visibilityProperties.indexOf(unprefixedProp) != -1) {
                    if(opts.fallback !== true) {
                        decl.removeSelf();
                    }
                } else if (paintProperties.indexOf(unprefixedProp) != -1) {
                    decl.removeSelf();   
                }
            });

            css.eachAtRule(/(keyframes)$/, function(rule) {
                rule.removeSelf();
            });
        };  
    }
    

});
