import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const TEMPLATE_DOC_ID = '1A8c7jl0mgwDDpZKNA6Af169eBYX7Zm5LK29Esc23BbY';
const TARGET_FOLDER_ID = '1szME7BfDsdm28ukYXFIDB0KjiujiD6E6';
const DRIVE_OWNER_EMAIL = 'jhon.hendry.tafui@gmail.com';

async function getAuthClient() {
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
    }

    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/documents',
        ],
    });

    return auth;
}

export async function POST(request: Request) {
    try {
        const { className, groupNumber, projectTitle, teamMembers } = await request.json();

        if (!className || !groupNumber || !projectTitle) {
            return NextResponse.json(
                { error: 'Missing required fields: className, groupNumber, projectTitle' },
                { status: 400 }
            );
        }

        // Parse grade and class number from className (e.g., '10.3' -> grade=10, classNum=3)
        const parts = className.split('.');
        const gradeLevel = parts[0];
        const classNumber = parts[1] || '1';

        const docName = `Grade ${gradeLevel}_Class ${classNumber}_Group ${groupNumber}`;

        // Build group members string
        const membersString = Array.isArray(teamMembers) && teamMembers.length > 0
            ? teamMembers.map((m: { full_name: string }) => m.full_name).join(', ')
            : 'N/A';

        // Authenticate
        const auth = await getAuthClient();
        const drive = google.drive({ version: 'v3', auth });
        const docs = google.docs({ version: 'v1', auth });

        // Step 0: Clean up the service account's Drive to free quota
        // Previous copies may have filled the service account's limited 15GB storage
        try {
            const ownedFiles = await drive.files.list({
                q: "'me' in owners",
                fields: 'files(id)',
                pageSize: 100,
            });
            if (ownedFiles.data.files && ownedFiles.data.files.length > 0) {
                for (const file of ownedFiles.data.files) {
                    if (file.id) {
                        await drive.files.delete({ fileId: file.id }).catch(() => {});
                    }
                }
            }
            // Also empty the trash
            await drive.files.emptyTrash().catch(() => {});
        } catch (cleanupErr) {
            console.warn('Drive cleanup warning (non-fatal):', cleanupErr);
        }

        // Step 1: Copy the template into the service account's own drive first
        const copyResponse = await drive.files.copy({
            fileId: TEMPLATE_DOC_ID,
            requestBody: {
                name: docName,
            },
        });

        const newDocId = copyResponse.data.id;
        if (!newDocId) {
            throw new Error('Failed to copy template document');
        }

        // Step 2: Transfer ownership to the Drive owner so the file uses their quota
        await drive.permissions.create({
            fileId: newDocId,
            transferOwnership: true,
            requestBody: {
                type: 'user',
                role: 'owner',
                emailAddress: DRIVE_OWNER_EMAIL,
            },
        });

        // Step 3: Move the file into the target folder (now owned by the real user)
        // Get current parents first
        const fileInfo = await drive.files.get({
            fileId: newDocId,
            fields: 'parents',
        });
        const previousParents = (fileInfo.data.parents || []).join(',');

        await drive.files.update({
            fileId: newDocId,
            addParents: TARGET_FOLDER_ID,
            removeParents: previousParents,
            requestBody: {},
        });

        // Step 4: Replace placeholders in the new document
        await docs.documents.batchUpdate({
            documentId: newDocId,
            requestBody: {
                requests: [
                    {
                        replaceAllText: {
                            containsText: { text: '<project_title>', matchCase: false },
                            replaceText: projectTitle,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '<group_members>', matchCase: false },
                            replaceText: membersString,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '<student_class>', matchCase: false },
                            replaceText: className,
                        },
                    },
                ],
            },
        });

        // Step 5: Set the document to "Anyone with the link can edit"
        await drive.permissions.create({
            fileId: newDocId,
            requestBody: {
                type: 'anyone',
                role: 'writer',
            },
        });

        const docUrl = `https://docs.google.com/document/d/${newDocId}/edit`;

        return NextResponse.json({
            success: true,
            docUrl,
            docId: newDocId,
            docName,
        });
    } catch (error: any) {
        console.error('Generate doc error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to generate document',
                details: error.errors || null,
            },
            { status: 500 }
        );
    }
}
