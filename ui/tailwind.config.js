/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0A0A0F',
                panel: 'rgba(255, 255, 255, 0.03)',
                frontal: '#0066FF',
                temporal: '#FFB800',
                occipital: '#FF00AA',
                parietal: '#00CC66'
            }
        },
    },
    plugins: [],
}
