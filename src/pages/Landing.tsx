import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import landingBg from "@/assets/landing-bg.jpg";
const Landing = () => {
  return <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{
      backgroundImage: `url(${landingBg})`,
      backgroundPosition: 'center bottom'
    }} />
      
      {/* Dark Overlay - darker at top, fading toward middle */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/70 to-black/50" />
      
      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        {/* Logo / App name */}
        <p className="mb-8 text-sm font-medium uppercase tracking-widest text-white/80">
          Breadcrumbs
        </p>
        
        {/* Main heading */}
        <h1 className="mb-10 font-serif text-4xl font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
          Welcome to Breadcrumbs
        </h1>
        
        {/* Description block */}
        <div className="mb-8 max-w-2xl space-y-6 text-base leading-relaxed text-white/90 md:text-lg">
          <p>
            Traditional legacy tools look backward — they preserve what once was.
            <br />
            Breadcrumbs looks forward — it preserves what still is and allows it to keep speaking.
          </p>
          <p>That means your spouse, children, grandchildren or loved one isn't just remembering you.
They're interacting with your voice, your words, and your perspective in a way that feels alive.<br />
            They're interacting with your voice, your words, and your perspective in a way that feels alive.
          </p>
        </div>
        
        {/* MVP line */}
        <p className="mb-12 max-w-xl text-sm text-white/70 md:text-base">
          Record your wisdom, organize it for the people you love, and let them keep asking questions.
        </p>
        
        {/* Primary button */}
        <Link to="/get-started">
          <Button className="bg-amber-100 px-8 py-3 text-base font-medium text-amber-950 hover:bg-amber-200" size="lg">
            Get Started
          </Button>
        </Link>
      </div>
    </div>;
};
export default Landing;