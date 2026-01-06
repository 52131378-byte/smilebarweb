import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../utils/apiBase";
import {
  adminLogoutApi,
  getAdminSession,
  getAdminToken,
} from "../../utils/adminStorage";

function Section({ title, children, right }) {
  return (
    <div
      style={{
        border: "1px solid #e6e6e6",
        borderRadius: 12,
        padding: 16,
        background: "white",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const session = useMemo(() => getAdminSession(), []);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [catName, setCatName] = useState("");
  const [catError, setCatError] = useState("");
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);

  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodImagePath, setProdImagePath] = useState("");
  const [prodImagePreviewUrl, setProdImagePreviewUrl] = useState("");
  const [prodImageUploading, setProdImageUploading] = useState(false);
  const [prodImageUploadError, setProdImageUploadError] = useState("");
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodError, setProdError] = useState("");
  const [deletingProductId, setDeletingProductId] = useState(null);

  const token = getAdminToken();
  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  function normalizeId(obj) {
    if (!obj) return obj;
    const id =
      obj.id ||
      obj._id ||
      obj.categoryId ||
      obj.category_id ||
      obj.itemId ||
      obj.item_id;
    return id ? { ...obj, id } : obj;
  }

  async function readJson(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  async function refresh() {
    setLoading(true);
    setCatError("");
    setProdError("");

    try {
      const [catsRes, itemsRes] = await Promise.all([
        fetch(apiUrl("/api/categories"), {
          headers: { ...authHeaders },
          credentials: "include",
        }),
        fetch(apiUrl("/api/items"), {
          headers: { ...authHeaders },
          credentials: "include",
        }),
      ]);

      const catsData = await readJson(catsRes);
      const itemsData = await readJson(itemsRes);

      if (!catsRes.ok) {
        setCatError(
          catsData?.message ||
            catsData?.error ||
            `Failed to load categories (HTTP ${catsRes.status}).`
        );
      }
      if (!itemsRes.ok) {
        setProdError(
          itemsData?.message ||
            itemsData?.error ||
            `Failed to load products (HTTP ${itemsRes.status}).`
        );
      }

      const catsArr = Array.isArray(catsData) ? catsData : catsData?.data;
      const itemsArr = Array.isArray(itemsData) ? itemsData : itemsData?.data;

      setCategories(Array.isArray(catsArr) ? catsArr.map(normalizeId) : []);
      setProducts(Array.isArray(itemsArr) ? itemsArr.map(normalizeId) : []);
    } catch (err) {
      setCatError(err?.message || "Failed to load categories.");
      setProdError(err?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (prodImagePreviewUrl) URL.revokeObjectURL(prodImagePreviewUrl);
    };
  }, [prodImagePreviewUrl]);

  async function uploadImage(file) {
    const uploadPath = process.env.REACT_APP_UPLOAD_ENDPOINT || "/api/upload";
    const uploadField = process.env.REACT_APP_UPLOAD_FIELD || "image";

    const form = new FormData();
    // IMPORTANT: send only ONE file field (many backends use multer.single('...'))
    form.append(uploadField, file);

    const res = await fetch(apiUrl(uploadPath), {
      method: "POST",
      headers: { ...authHeaders },
      credentials: "include",
      body: form,
    });

    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(
        data?.message || data?.error || `Upload failed (HTTP ${res.status}).`
      );
    }

    const candidate =
      data?.image ||
      data?.path ||
      data?.filePath ||
      data?.url ||
      data?.data?.image ||
      data?.data?.path ||
      data?.data?.url;

    if (typeof candidate === "string" && candidate) {
      if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
        try {
          const u = new URL(candidate);
          return u.pathname; // -> "/uploads/..."
        } catch {
          return candidate;
        }
      }
      return candidate;
    }

    const filename = data?.filename || data?.file?.filename || data?.data?.filename;
    if (filename) return `/uploads/${filename}`;

    throw new Error("Upload succeeded but response did not include image path.");
  }

  const onPickImage = async (e) => {
    setProdImageUploadError("");
    setProdError("");

    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (prodImagePreviewUrl) URL.revokeObjectURL(prodImagePreviewUrl);
    setProdImagePreviewUrl(URL.createObjectURL(file));

    setProdImageUploading(true);
    try {
      const path = await uploadImage(file);
      setProdImagePath(path);
    } catch (err) {
      setProdImagePath("");
      setProdImageUploadError(err?.message || "Image upload failed.");
    } finally {
      setProdImageUploading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogout = async () => {
    await adminLogoutApi();
    navigate("/admin/login", { replace: true });
  };

  const onCreateCategory = async (e) => {
    e.preventDefault();
    setCatError("");

    try {
      const name = String(catName || "").trim();
      if (!name) return setCatError("Category name is required.");

      const res = await fetch(apiUrl("/api/categories"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        credentials: "include",
        body: JSON.stringify({ name }),
      });

      const data = await readJson(res);
      if (!res.ok) {
        setCatError(
          data?.message || data?.error || `Failed (HTTP ${res.status}).`
        );
        return;
      }

      setCatName("");
      await refresh();
    } catch (err) {
      setCatError(err?.message || "Failed to create category.");
    }
  };

  const onCreateProduct = async (e) => {
    e.preventDefault();
    setProdError("");

    try {
      const name = String(prodName || "").trim();
      const price = Number(prodPrice);
      const image = String(prodImagePath || "").trim();
      const categoryIdRaw = String(prodCategoryId || "").trim();
      const categoryIdNum = categoryIdRaw ? Number(categoryIdRaw) : null;

      if (!name) return setProdError("Product name is required.");
      if (Number.isNaN(price) || price <= 0)
        return setProdError("Price must be a number > 0.");
      if (prodImageUploading) return setProdError("Please wait for image upload.");
      if (!image) return setProdError("Please upload an image.");
      if (!categoryIdRaw) return setProdError("category_id is required.");
      if (categoryIdRaw) {
        if (Number.isNaN(categoryIdNum) || categoryIdNum <= 0) {
          return setProdError("category_id must be a positive integer.");
        }
      }

      const res = await fetch(apiUrl("/api/items"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        credentials: "include",
        body: JSON.stringify({
          name,
          price,
          image,
          ...(categoryIdNum ? { category_id: categoryIdNum } : {}),
        }),
      });

      const data = await readJson(res);
      if (!res.ok) {
        setProdError(
          data?.message || data?.error || `Failed (HTTP ${res.status}).`
        );
        return;
      }

      setProdName("");
      setProdPrice("");
      setProdImagePath("");
      setProdImageUploadError("");
      if (prodImagePreviewUrl) URL.revokeObjectURL(prodImagePreviewUrl);
      setProdImagePreviewUrl("");
      setProdCategoryId("");
      await refresh();
    } catch (err) {
      setProdError(err?.message || "Failed to create product.");
    }
  };

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: "30px auto",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            Logged in as <b>{session?.username || "admin"}</b>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <Section title="Create Category">
        <form onSubmit={onCreateCategory} style={{ display: "flex", gap: 10 }}>
          <input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Category name"
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Add
          </button>
        </form>
        {catError ? (
          <div style={{ color: "#b00020", marginTop: 10 }}>{catError}</div>
        ) : null}
      </Section>

      <Section
        title={`Categories (${categories.length})`}
        right={
          <button
            onClick={refresh}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Refresh
          </button>
        }
      >
        {loading ? (
          <div style={{ opacity: 0.8 }}>Loading...</div>
        ) : categories.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No categories yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {categories.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div>
                  <b>{c.name}</b>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    id: {c.id}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (
                      deletingCategoryId != null &&
                      String(deletingCategoryId) === String(c.id)
                    )
                      return;

                    const ok = window.confirm(
                      `Delete category "${c.name}"? This cannot be undone.`
                    );
                    if (!ok) return;

                    setCatError("");
                    setDeletingCategoryId(c.id);
                    try {
                      const res = await fetch(
                        apiUrl(`/api/categories/${c.id}`),
                        {
                          method: "DELETE",
                          headers: { ...authHeaders },
                          credentials: "include",
                        }
                      );
                      const data = await readJson(res);
                      if (!res.ok) {
                        setCatError(
                          data?.message ||
                            data?.error ||
                            `Delete failed (HTTP ${res.status}).`
                        );
                        return;
                      }
                      if (String(prodCategoryId) === String(c.id))
                        setProdCategoryId("");
                      await refresh();
                    } catch (err) {
                      setCatError(err?.message || "Delete failed.");
                    } finally {
                      setDeletingCategoryId(null);
                    }
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ffb3b3",
                    background: "#ffe5e5",
                    color: "#8a1f1f",
                    cursor: "pointer",
                    fontWeight: 600,
                    opacity:
                      deletingCategoryId != null &&
                      String(deletingCategoryId) === String(c.id)
                        ? 0.7
                        : 1,
                  }}
                  disabled={
                    deletingCategoryId != null &&
                    String(deletingCategoryId) === String(c.id)
                  }
                >
                  {deletingCategoryId != null &&
                  String(deletingCategoryId) === String(c.id)
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
        {catError ? (
          <div style={{ color: "#b00020", marginTop: 10 }}>{catError}</div>
        ) : null}
      </Section>

      <Section title="Create Product">
        <form
          onSubmit={onCreateProduct}
          style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}
        >
          <input
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            placeholder="Product name"
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />

          <input
            value={prodPrice}
            onChange={(e) => setProdPrice(e.target.value)}
            placeholder="Price"
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />

          <input
            type="file"
            accept="image/*"
            onChange={onPickImage}
            style={{
              gridColumn: "1 / -1",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />

          {prodImagePreviewUrl ? (
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <img
                src={prodImagePreviewUrl}
                alt="preview"
                style={{
                  width: 90,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid #eee",
                }}
              />
              <div style={{ fontSize: 13 }}>
                <div>
                  <b>Upload</b>: {prodImageUploading ? "uploading..." : "ready"}
                </div>
                <div style={{ opacity: 0.8 }}>
                  server path: <code>{prodImagePath || "(not uploaded yet)"}</code>
                </div>
                {prodImageUploadError ? (
                  <div style={{ color: "#b00020", marginTop: 6 }}>
                    {prodImageUploadError}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <select
            value={prodCategoryId}
            onChange={(e) => setProdCategoryId(e.target.value)}
            style={{
              gridColumn: "1 / -1",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "white",
            }}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={prodImageUploading}
            style={{
              gridColumn: "1 / -1",
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              opacity: prodImageUploading ? 0.7 : 1,
            }}
          >
            {prodImageUploading ? "Uploading image..." : "Add Product"}
          </button>
        </form>

        {prodError ? (
          <div style={{ color: "#b00020", marginTop: 10 }}>{prodError}</div>
        ) : null}
      </Section>

      <Section
        title={`Products (${products.length})`}
        right={
          <button
            onClick={refresh}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Refresh
          </button>
        }
      >
        {loading ? (
          <div style={{ opacity: 0.8 }}>Loading...</div>
        ) : products.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No products yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {products.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <img
                  src={
                    p.image?.startsWith("/uploads/")
                      ? apiUrl(p.image)
                      : p.image || "/logo.png"
                  }
                  alt={p.name}
                  style={{
                    width: 70,
                    height: 50,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid #eee",
                  }}
                />
                <div>
                  <b>{p.name}</b> — ${p.price}
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    category:{" "}
                    {(p.category_id || p.categoryId || p.category)
                      ? categories.find(
                          (c) =>
                            String(c.id) ===
                            String(p.category_id || p.categoryId || p.category)
                        )?.name || "(deleted)"
                      : "(none)"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>id: {p.id}</div>
                </div>
                <button
                  onClick={async () => {
                    if (
                      deletingProductId != null &&
                      String(deletingProductId) === String(p.id)
                    )
                      return;

                    const ok = window.confirm(
                      `Delete item "${p.name}"? This cannot be undone.`
                    );
                    if (!ok) return;

                    setProdError("");
                    setDeletingProductId(p.id);
                    try {
                      const res = await fetch(apiUrl(`/api/items/${p.id}`), {
                        method: "DELETE",
                        headers: { ...authHeaders },
                        credentials: "include",
                      });
                      const data = await readJson(res);
                      if (!res.ok) {
                        setProdError(
                          data?.message ||
                            data?.error ||
                            `Delete failed (HTTP ${res.status}).`
                        );
                        return;
                      }
                      await refresh();
                    } catch (err) {
                      setProdError(err?.message || "Delete failed.");
                    } finally {
                      setDeletingProductId(null);
                    }
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ffb3b3",
                    background: "#ffe5e5",
                    color: "#8a1f1f",
                    cursor: "pointer",
                    fontWeight: 600,
                    opacity:
                      deletingProductId != null &&
                      String(deletingProductId) === String(p.id)
                        ? 0.7
                        : 1,
                  }}
                  disabled={
                    deletingProductId != null &&
                    String(deletingProductId) === String(p.id)
                  }
                >
                  {deletingProductId != null &&
                  String(deletingProductId) === String(p.id)
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
        {prodError ? (
          <div style={{ color: "#b00020", marginTop: 10 }}>{prodError}</div>
        ) : null}
      </Section>
    </div>
  );
}


