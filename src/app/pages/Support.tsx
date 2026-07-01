import { Mail, Phone, Clock, UserPlus, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';

const faqs = [
  {
    q: "I can't sign in — what should I do?",
    a: 'Make sure you are using the student number and password provided to you by the academy, and that you are connected to the internet. If you still cannot sign in, email us and we will help reset your access.',
  },
  {
    q: 'How do I access my subjects and quizzes?',
    a: 'After signing in, the subjects for your grade appear on your home page. Open a subject to watch its lesson videos and take the available quizzes. If a subject you expect is missing, contact us so we can check your enrolment.',
  },
  {
    q: 'How do I enrol or get an account?',
    a: 'Accounts are created and managed by Bethunana Academy — there is no public sign-up. To enrol as a student and receive your login details, contact the academy using the email or phone number above. There is no charge to create or use your account.',
  },
  {
    q: 'How do I update my details or reset my password?',
    a: 'Contact the academy using the details above and we will update your profile or reset your password for you.',
  },
];

export function Support() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-12 lg:px-8">
          <h1 className="text-3xl font-bold">Support</h1>
          <p className="mt-2 max-w-2xl text-primary-foreground/80">
            Need help with the Bethunana Academy app? We&rsquo;re here to assist enrolled
            students with signing in, accessing subjects and quizzes, watching lessons, and any
            other questions about using the app.
          </p>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Contact us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Email</p>
                <a href="mailto:magiftana22@gmail.com" className="text-primary hover:underline">
                  magiftana22@gmail.com
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Phone / WhatsApp</p>
                <a href="tel:+27660936871" className="text-primary hover:underline">
                  066 093 6871
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Response time</p>
                <p className="text-muted-foreground">
                  Emails are responded to within 12 hours on a working day (Monday&ndash;Friday,
                  SAST).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              How to enrol or get an account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Accounts are created and managed by Bethunana Academy — there is no public sign-up
              in the app. To enrol as a student and receive your login details, please contact
              the academy using the email or phone number above. There is no charge to create or
              use your account within the app.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Frequently asked questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <footer className="mt-12 border-t border-border pt-4 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Bethunana Academy. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
