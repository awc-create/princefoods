"use client";
import { useState } from "react";
import Basket from "./Basket";

export default function BasketButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Basket</button>
      {open && <Basket onClose={() => setOpen(false)} />}
    </>
  );
}
