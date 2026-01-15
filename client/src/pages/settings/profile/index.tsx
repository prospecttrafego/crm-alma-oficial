/**
 * Profile Settings Page
 * Contains profile, appearance, and account settings
 */

import { ProfileSection } from "../profile-section";
import { AppearanceSection } from "../appearance-section";
import { AccountSection } from "../account-section";

export default function ProfilePage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProfileSection />
      <AppearanceSection />
      <AccountSection />
    </div>
  );
}
