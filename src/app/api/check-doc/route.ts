import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url || !url.includes('docs.google.com')) {
            return NextResponse.json({ isPublic: false, error: 'Url tidak valid.' }, { status: 400 });
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; STEAMBot/1.0)',
            },
            redirect: 'follow',
        });

        const html = await response.text();

        // Check if the response was redirected to the Google Login page.
        // Public documents do not redirect to ServiceLogin.
        if (response.url.includes('ServiceLogin')) {
            return NextResponse.json({ isPublic: false, error: 'Dokumen ini dikunci (Private). Ubah akses menjadi "Anyone with the link".' });
        }

        return NextResponse.json({ isPublic: true });

    } catch (error) {
        console.error("Doc validation error:", error);
        // If we can't fetch it, we assume it might be private or broken
        return NextResponse.json({ isPublic: false, error: 'Gagal mengecek URL. Pastikan link dapat diakses publik.' }, { status: 500 });
    }
}
