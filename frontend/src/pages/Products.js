import { useEffect, useState } from "react";
import ProductCard from "../Components/ProductCard";
import { apiUrl } from "../utils/apiBase";

export default function Products() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const baseProducts = [
    {
      id: 1,
      name: "Strawberry CheeseCake",
      price: 5,
      image: "/straw.jpg",
    },
    {
      id: 2,
      name: "Lotus CheeseCake",
      price: 7,
      image: "/lotus.jpg",
    },
    {
      id: 3,
      name: "Oreo CheeseCake",
      price: 7,
      image: "/oero.jpg",
    },
    {
      id: 4,
      name: "Choco Crepe",
      price: 6,
      image: "/choco.jpg",
    },
    {
      id: 5,
      name: "Choco Pistasio Crepe",
      price: 10,
      image: "/pistacio.jpg",
    },
     {
      id: 6,
      name: "Pistasio fruit Crepe",
      price: 15,
      image: "/pistaciofruit.jpg",
    },
  ];

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
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, []);

  const products = items.length > 0 ? items : baseProducts;

  return (
    <div style={{ padding: "20px" }}>
      <h2>Our Products</h2>
      {loading ? <p>Loading...</p> : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          marginTop: "20px",
        }}
      >
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
