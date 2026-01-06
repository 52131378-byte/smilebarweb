import { useEffect, useState } from "react";
import ProductCard from "../Components/ProductCard";
import HeroMosaic from "../Components/HeroMosaic";
import { apiUrl } from "../utils/apiBase";

export default function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/items"))
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : data?.data;
        const normalized = Array.isArray(arr)
          ? arr.map((x) => ({ ...x, id: x.id || x._id }))
          : [];
        setItems(normalized);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <h2 style={{ margin: "0 0 6px" }}>Welcome to SmileBAR</h2>
        <p style={{ margin: 0 }}>Find your yummy item on your favorite gadgets!</p>
      </div>

      <HeroMosaic
        leftImage="/2026smilebar.jpeg"
        topRightImage="/choco.jpg"
        bottomRightImage="/straw.jpg"
      />
      {loading ? <p style={{ padding: "20px 0" }}>Loading...</p> : null}

      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          marginTop: "20px",
        }}
      >
        {!loading && items.length === 0 ? (
          <p>No items found</p>
        ) : null}
        {!loading ? (
          items.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))
        ) : null}
      </div>
    </div>
  );
}
