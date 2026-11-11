/**
 * dsh-a11y — Host half.
 *
 * v1 has no Host-side behavior: announcements, navigation, and preferences all
 * live in the browser half. The Host row exists so the bundle is a normal,
 * switchable plugin whose Client half can be loaded by the module system. A
 * later version can add a Host Config and a settings projection here without
 * changing the package shape.
 */
export function apply() {}
