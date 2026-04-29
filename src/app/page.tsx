import { NinjaTypingGame } from "@/components/NinjaTypingGame";
import { SITE_BRAND, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/site";

const faqItems = [
  {
    question: "Ninja Typing / 忍者タイピングは無料で遊べますか？",
    answer: "無料で遊べるブラウザ向けタイピングゲームです。インストール不要で、PCキーボードからすぐに練習できます。"
  },
  {
    question: "日本語のお題はどのように入力しますか？",
    answer: "表示されたふりがなをローマ字で入力します。たとえば「し」は si、shi、ci など複数の入力方法に対応しています。"
  },
  {
    question: "ランキング登録には何が必要ですか？",
    answer: "ランキングに登録する場合は、会員登録またはログインが必要です。各難易度ごとにユーザー1人につき1件の記録を保存できます。"
  },
  {
    question: "スマートフォンでも遊べますか？",
    answer: "画面はレスポンシブ対応していますが、ゲーム性はPCキーボードでのプレイを優先して設計しています。"
  }
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      name: SITE_NAME,
      alternateName: ["Ninja Typing", "忍者タイピング"],
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      inLanguage: "ja-JP"
    },
    {
      "@type": "WebApplication",
      "@id": `${absoluteUrl("/")}#webapp`,
      name: SITE_NAME,
      applicationCategory: "GameApplication",
      operatingSystem: "Web Browser",
      browserRequirements: "Requires JavaScript. Recommended for PC keyboard play.",
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      inLanguage: "ja-JP",
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "JPY"
      },
      publisher: {
        "@type": "Organization",
        name: SITE_BRAND
      }
    },
    {
      "@type": "FAQPage",
      "@id": `${absoluteUrl("/")}#faq`,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    }
  ]
};

function SeoContent() {
  return (
    <section className="seo-content" aria-labelledby="seo-overview-title">
      <div className="seo-content-inner">
        <div className="seo-intro">
          <span>ABOUT THE GAME</span>
          <h2 id="seo-overview-title">手裏剣が飛ぶ、爽快な忍者タイピングゲーム</h2>
          <p>
            Ninja Typing / 忍者タイピングは、日本語のお題をローマ字で入力して敵を倒すブラウザゲームです。
            タイピング練習の正確さと、コンボで演出が強くなるゲーム性を組み合わせています。
          </p>
        </div>

        <div className="seo-card-grid">
          <article className="seo-card">
            <h3>このサイトでできること</h3>
            <p>
              Easy、Normal、Hardの難易度から選び、60秒間でどれだけ多くのお題を正確に入力できるか挑戦できます。
              スコア、正確率、最大コンボ、ミス数を確認し、ランキング上位も目指せます。
            </p>
          </article>

          <article className="seo-card">
            <h3>使い方 / 遊び方</h3>
            <p>
              画面に表示されたふりがなをローマ字で入力します。入力が合っている文字は光り、ミスすると赤く反応します。
              お題を打ち切ると忍者が手裏剣を投げ、敵を撃破して次のお題へ進みます。
            </p>
          </article>

          <article className="seo-card">
            <h3>特徴</h3>
            <p>
              複数のローマ字入力パターン、コンボ演出、設定画面、Xシェア、Supabaseランキングに対応。
              軽量なNext.jsアプリとして、Vercel公開でも扱いやすい構成です。
            </p>
          </article>
        </div>

        <div className="seo-faq" id="faq">
          <h2>よくある質問</h2>
          <div className="seo-faq-list">
            {faqItems.map((item) => (
              <article className="seo-faq-item" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <NinjaTypingGame />
      <SeoContent />
    </>
  );
}
