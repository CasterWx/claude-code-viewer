/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#F0F0F0',
                foreground: '#121212',
                primary: {
                    red: '#D02020',
                    blue: '#1040C0',
                    yellow: '#F0C020',
                },
                github: {
                    0: '#ebedf0',
                    1: '#9be9a8',
                    2: '#40c463',
                    3: '#30a14e',
                    4: '#216e39',
                },
                border: '#121212',
                muted: '#E0E0E0',
            },
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
            },
            boxShadow: {
                'hard-sm': '4px 4px 0px 0px #121212',
                'hard-md': '6px 6px 0px 0px #121212',
                'hard-lg': '8px 8px 0px 0px #121212',
            },
            borderWidth: {
                '3': '3px',
                '4': '4px',
            }
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],

}
