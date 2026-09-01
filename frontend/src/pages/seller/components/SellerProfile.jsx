import UniversalImageEditor from '../../../components/UniversalImageEditor';

function SellerProfile({
  activeTab,
  API_BASE,
  userProfile,
  profileImageRefreshKey,
  isProfilePhotoMenuOpen,
  setIsProfilePhotoMenuOpen,
  pushBrowserHistory,
  resetBrowserHistory,
  setUserProfile,
  setProfileImageRefreshKey,
  isDocumentsModalOpen,
  setIsDocumentsModalOpen,
  activeDocumentPreview,
  setActiveDocumentPreview,
  restaurant
}) {
  return (
    <>
            {/* ================= SELLER PROFILE ================= */}

<section className="space-y-6">
  <div className="relative flex items-start justify-between gap-6">
    <div className="min-w-0">
      <h2 className="text-2xl font-black text-white sm:text-3xl">
        Profile
      </h2>

      <p className="mt-1 text-sm font-medium text-gray-400">
        Seller account information
      </p>
    </div>

    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setIsProfilePhotoMenuOpen(true);

          pushBrowserHistory({
            tab: activeTab,
            profilePhoto: 'menu'
          });
        }}
        className="h-16 w-16 overflow-hidden rounded-full border-2 border-gray-600 bg-gray-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 sm:h-20 sm:w-20"
        aria-label="Change profile photo"
      >
        {userProfile?.profileImage ? (
          <img
            src={`${API_BASE}/api/auth/profile/photo?v=${profileImageRefreshKey}`}
            alt={userProfile?.name || "Seller"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl font-black text-gray-400">
            {userProfile?.name?.charAt(0)?.toUpperCase() || "S"}
          </span>
        )}
      </button>

      <UniversalImageEditor
        open={isProfilePhotoMenuOpen}
        ariaLabel="Profile photo"
        onClose={() => {
          setIsProfilePhotoMenuOpen(false);

          resetBrowserHistory({
            tab: activeTab,
            profilePhoto: null
          });
        }}
        onSave={async ({ blob }) => {
          const formData = new FormData();

          formData.append(
            'profileImage',
            blob,
            'profile-photo.jpg'
          );

          const response = await fetch(
            `${API_BASE}/api/auth/profile/photo`,
            {
              method: 'POST',
              credentials: 'include',
              body: formData
            }
          );

          const responseData = await response.json();

          if (!response.ok || !responseData.success) {
            throw new Error(
              responseData.message ||
                responseData.error ||
                'Failed to save profile photo.'
            );
          }

          if (responseData.user) {
            setUserProfile(responseData.user);
            setProfileImageRefreshKey(Date.now());
          }
        }}
      />
    </div>
  </div>

  <div className="space-y-3">
    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        Name :
      </span>
      <span className="min-w-0 break-words text-sm font-bold text-white">
                {userProfile?.name || "Not Provided"}
      </span>
    </div>

    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        Email :
      </span>
      <span className="min-w-0 break-all text-sm font-bold text-white">
        {userProfile?.email || "Not Provided"}
      </span>
    </div>

    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        Seller ID :
      </span>
      <span className="min-w-0 break-all font-mono text-xs font-bold text-white">
        {userProfile?.id || "Not Provided"}
      </span>
    </div>

    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        Phone :
      </span>
              <span className="min-w-0 break-words text-sm font-bold text-white">
          {userProfile?.phone || "Not Provided"}
        </span>
    </div>

    <div className="flex items-center gap-3 pt-1">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        KYC :
      </span>

      <span
        className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
          userProfile?.kycStatus === "VERIFIED"
            ? "bg-emerald-500/10 text-emerald-400"
            : userProfile?.kycStatus === "REJECTED"
            ? "bg-red-500/10 text-red-400"
            : "bg-amber-500/10 text-amber-400"
        }`}
      >
        {userProfile?.kycStatus || "PENDING"}
      </span>
    </div>
  </div>

  <button
    type="button"
    onClick={() => {
      setActiveDocumentPreview(null);
      setIsDocumentsModalOpen(true);
    }}
    className="inline-flex items-center text-sm font-black text-white transition hover:text-orange-400 active:scale-[0.98]"
  >
    Documents
  </button>

  {isDocumentsModalOpen && (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-md"
      onClick={() => {
        if (activeDocumentPreview) {
          setActiveDocumentPreview(null);
        } else {
          setIsDocumentsModalOpen(false);
        }
      }}
    >
      {!activeDocumentPreview ? (
        <div
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-gray-900/75 p-5 shadow-2xl backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-black text-white">
              Documents
            </h3>

            <button
              type="button"
              onClick={() => setIsDocumentsModalOpen(false)}
              className="text-xl font-black text-gray-400 transition hover:text-white"
              aria-label="Close documents"
            >
            </button>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={!restaurant?.image}
              onClick={() => {
                if (!restaurant?.image) return;

                setActiveDocumentPreview({
                  type: "restaurant",
                  title: "Restaurant Image",
                  src: `${API_BASE}/api/seller/${restaurant._id}/image`
                });
              }}
              className="w-full border-b border-white/10 py-3 text-left text-sm font-black text-white transition hover:bg-white/5 hover:text-orange-400 active:bg-orange-500/10 active:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Restaurant Image</span>
            </button>

            <button
              type="button"
              disabled={!restaurant?.registrationDoc}
              onClick={() => {
                if (!restaurant?.registrationDoc) return;

                setActiveDocumentPreview({
                  type: "registration",
                  title: "Registration Document",
                  src: `${API_BASE}/api/kyc/documents/${encodeURIComponent(
                    restaurant.registrationDoc.split("/").pop().split("\\").pop()
                  )}`
                });
              }}
              className="w-full py-3 text-left text-sm font-black text-white transition hover:bg-white/5 hover:text-orange-400 active:bg-orange-500/10 active:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Registration Document</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="relative flex max-h-[92vh] w-full max-w-5xl items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gray-950/85 p-4 shadow-2xl backdrop-blur-xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <img
            src={activeDocumentPreview.src}
            alt={activeDocumentPreview.title}
            className="max-h-[84vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </div>
  )}
</section>
    </>
  );
}

export default SellerProfile;
