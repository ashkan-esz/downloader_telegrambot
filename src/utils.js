export function capitalize(str) {
    return str.split('_').map(t => t[0].toUpperCase() + t.slice(1)).join(' ')
        .split('-').map(gg => gg[0].toUpperCase() + gg.slice(1)).join('-');
}