/**
 * This script uses the Clerk Backend API to directly set the role
 * in the user's Clerk publicMetadata — no browser sign-out required.
 */

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const TARGET_EMAIL = "li8993han@gmail.com";
const NEW_ROLE = "OWNER";

async function main() {
  if (!CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is not set in environment variables");
  }

  // 1. Find user by email
  const searchRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(TARGET_EMAIL)}`,
    {
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!searchRes.ok) {
    const err = await searchRes.text();
    throw new Error(`Failed to find user: ${err}`);
  }

  const users = await searchRes.json();
  if (!users || users.length === 0) {
    throw new Error(`No Clerk user found with email: ${TARGET_EMAIL}`);
  }

  const clerkUser = users[0];
  console.log(`✅ Found Clerk user: ${clerkUser.id} (${TARGET_EMAIL})`);
  console.log(`   Current role in metadata: ${clerkUser.public_metadata?.role ?? "(none)"}`);

  // 2. Update publicMetadata.role
  const updateRes = await fetch(
    `https://api.clerk.com/v1/users/${clerkUser.id}/metadata`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_metadata: {
          role: NEW_ROLE,
        },
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    throw new Error(`Failed to update Clerk metadata: ${err}`);
  }

  const updated = await updateRes.json();
  console.log(
    `🎉 Successfully updated Clerk role to: ${updated.public_metadata?.role}`
  );
  console.log(`   User: ${updated.first_name} ${updated.last_name} (${TARGET_EMAIL})`);
  console.log(`\n✅ Done! The user now has OWNER role in Clerk.`);
  console.log(`   Please refresh the browser at http://localhost:3000/dashboard`);
  console.log(`   The sidebar will immediately show all navigation tabs.`);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
