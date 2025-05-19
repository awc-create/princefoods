"use client";

import { useState } from "react";
import styles from "./Faq.module.scss";

const faqs = [
  {
    question: "What services do you offer?",
    answer: "We offer full-stack web development, e-commerce solutions, SEO, and branding."
  },
  {
    question: "How long does it take to build a site?",
    answer: "It depends on complexity, but typically between 2-6 weeks."
  },
  {
    question: "Do you provide support after launch?",
    answer: "Absolutely. We offer maintenance plans and technical support."
  },
  {
    question: "Can I request custom features?",
    answer: "Yes, we specialize in tailored solutions that meet your unique needs."
  },
  {
    question: "What does the Web Dev Wizard CLI actually generate?",
    answer:
      "It scaffolds a full Next.js 15 project with TypeScript, SCSS, a modern responsive layout, a navbar, footer, optional e-commerce components, and a sitemap. It also installs all required dependencies like react-icons, sass, and lottie-react."
  },
  {
    question: "How do I add more navigation links during setup?",
    answer:
      "When prompted during the wizard, you can enter additional page names separated by commas. These will be auto-created with boilerplate content and added to the navigation config."
  },
  {
    question: "Why is `Cart` and `Login` not in the menu config?",
    answer:
      "They are intentionally excluded from the navigation menu because they are rendered as icons when `isEcommerce` is enabled. Their functionality lives in the Navbar component logic."
  },
  {
    question: "Can I run this CLI from anywhere?",
    answer:
      "Yes. As long as Node.js and Yarn are installed, you can run it from any terminal using `node web-dev-wizard.mjs`. Just make sure the `template/` folder exists beside it."
  },
  {
    question: "What happens if I choose E-commerce mode?",
    answer:
      "The CLI will copy e-commerce specific components and pages (like CartIcon, LoginButton, and checkout templates) into your project. These are lazily loaded and don’t interfere with static sites."
  },
  {
    question: "I got a module not found error after setup. What do I do?",
    answer:
      "This usually happens if a dependency like `sass` or `lottie-react` wasn’t installed properly. Just run `yarn` or `yarn add` manually in your project folder to fix it."
  },
  {
    question: "Can I re-run the wizard inside an existing project?",
    answer:
      "It's recommended to use the wizard in a clean directory. It deletes and overwrites certain folders, so running it in an existing project might cause data loss."
  },
  {
    question: "Where can I customize the generated layout?",
    answer:
      "You can modify `src/app/layout.tsx` for the layout structure, or tweak SCSS styles in `src/styles/Global.scss` and component-specific modules."
  },
  {
    question: "How are the navigation links managed?",
    answer:
      "They are auto-generated into `src/config/menu.config.ts` based on your wizard choices. This config is consumed by the Navbar to render links."
  }
];

export default function FaqClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(prev => (prev === index ? null : index));
  };

  return (
    <div className={styles.wrapper}>
      <h1>Frequently Asked Questions</h1>
      <div className={styles.accordion}>
        {faqs.map((item, index) => (
          <div key={index} className={styles.item}>
            <button className={styles.question} onClick={() => toggle(index)}>
              {item.question}
              <span className={styles.icon}>{openIndex === index ? "−" : "+"}</span>
            </button>
            <div className={`${styles.answer} ${openIndex === index ? styles.open : ""}`}>
              <p>{item.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
