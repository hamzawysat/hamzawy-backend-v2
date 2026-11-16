# Store product images in MongoDB GridFS

New store product images are uploaded to the existing MongoDB database using the GridFS bucket named `media`. No external storage account or subscription is required.

## API

- `POST /api/admin/store/media`: admin-authenticated raw image upload.
- Accepted MIME types: JPEG, PNG, WebP.
- Maximum upload size: 5 MiB.
- The endpoint checks the file signature and returns `imageFileId` plus the public `imageUrl`.
- `GET /api/store/media/:id`: streams an image only when a StoreProduct references its GridFS id.

StoreProduct stores the GridFS ObjectId in `imageFileId`; `imageUrl` contains the API-relative media path. Public product listing resolves that path from the stored ObjectId. Existing external `imageUrl` values remain readable for backward compatibility.

## Data safety

- No existing image URL is deleted or rewritten by this feature.
- No existing images are migrated automatically.
- No media delete endpoint is provided, to avoid accidental data loss.
- GridFS uploads occur only after the feature is deployed and an administrator uploads a new image.
- GridFS stores image bytes in MongoDB's `media.files` and `media.chunks` collections.

Before production activation, verify available MongoDB storage quota and test a real image upload/download. A migration of any existing external images requires a separate inventory, backup, and explicit approval.


## Technician national ID card images

- New technician registrations require both the front and back of the national ID card.
- Uploads use the existing MongoDB GridFS `media` bucket and are tagged with purpose `fanni-id-document` and side metadata.
- Only authenticated administrators can retrieve an image, through `GET /api/fanni/admin/:id/identity/:side`. Images are served with `Cache-Control: private, no-store`; there is no public image URL.
- Accepted formats are JPEG, PNG, and WebP; each side is limited to 5 MiB and checked against its file signature.
- Registration verifies that the two supplied file IDs are separate GridFS objects with matching front/back metadata before creating the technician account.
- Uploaded bytes remain in MongoDB, not the web host filesystem. Abandoned uploads are not automatically deleted; retention/cleanup should be handled under an approved privacy policy.
