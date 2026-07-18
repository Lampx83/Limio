/**
 * Seed the two NEU College of Technology data-science courses from their
 * official syllabi (docs: Programming-for-data-science.pdf,
 * Fundamental-of-Machine-Learning.pdf, both dated 2025-06-17).
 *
 * Runs against whatever DATABASE_URL points at — local or, via SSH tunnel,
 * production. Idempotent end to end: re-running finds existing rows by their
 * natural keys (user email, course slug, module/lesson title, skill code) and
 * creates only what is missing.
 *
 * Goes through core-lms services rather than raw Prisma so we inherit the
 * audit trail, slug uniquification, LessonActivity rows (the lesson timeline
 * reads those, not ContentItem), and cycle-safe skill prerequisites.
 *
 *   pnpm --filter @feedbackme/web exec tsx scripts/seed-neu-ds-courses.ts
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  createCourse,
  createModule,
  createLesson,
  createContentItem,
  createSkill,
  tagLessonSkill,
  addSkillPrerequisite,
  publishCourse,
} from "@feedbackme/core-lms";

const OWNER_EMAIL = "lampx@neu.edu.vn";
const OWNER_NAME = "Phạm Xuân Lâm";
const BCRYPT_COST = 12;

// ─────────────────────────────────────────────────────────────────────────
// Skill graph. Codes follow the `^[a-z][a-z0-9._-]*$` rule enforced by
// createSkill. `requires` names prerequisite skills — the edge means "this
// skill requires that one". Cross-course edges (ml.* -> pds.*) encode the
// syllabus line "Pre-requisites: Programming for Data Science".
// ─────────────────────────────────────────────────────────────────────────
interface SkillDef {
  code: string;
  name: string;
  description: string;
  requires?: string[];
}

const SKILLS: SkillDef[] = [
  // Programming for Data Science — Module 1
  {
    code: "pds.intro.landscape",
    name: "The data science landscape",
    description:
      "How computer science, AI, machine learning, deep learning, and data science relate to one another, and where mathematics, statistics, and domain knowledge fit in.",
  },
  {
    code: "pds.python.basics",
    name: "Python variables, data types, and operators",
    description:
      "Core Python constructs: variables, built-in data types, and operators. Foundation for all further programming work in the course.",
  },
  {
    code: "pds.python.control_flow",
    name: "Control flow: conditionals and loops",
    description: "Directing program execution with if statements and loops.",
    requires: ["pds.python.basics"],
  },
  {
    code: "pds.python.functions",
    name: "Functions",
    description: "Structuring Python programs with reusable functions.",
    requires: ["pds.python.control_flow"],
  },
  {
    code: "pds.python.oop",
    name: "Basic object-oriented programming",
    description:
      "Writing structured Python using object-oriented approaches alongside procedural ones.",
    requires: ["pds.python.functions"],
  },
  // Programming for Data Science — Module 2
  {
    code: "pds.numpy.arrays",
    name: "NumPy arrays",
    description: "Working with numerical data using NumPy arrays.",
    requires: ["pds.python.basics"],
  },
  {
    code: "pds.pandas.dataframes",
    name: "Pandas DataFrames",
    description: "Working with tabular data using Pandas DataFrames.",
    requires: ["pds.numpy.arrays"],
  },
  {
    code: "pds.pandas.cleaning",
    name: "Data cleaning and transformation",
    description: "Cleaning and transforming tabular data with Pandas.",
    requires: ["pds.pandas.dataframes"],
  },
  {
    code: "pds.pandas.eda",
    name: "Aggregation and exploratory data analysis in Jupyter",
    description:
      "Aggregating data and performing exploratory data analysis interactively in Jupyter Notebooks.",
    requires: ["pds.pandas.cleaning"],
  },
  // Programming for Data Science — Module 3
  {
    code: "pds.web.rest_api",
    name: "Retrieving data via RESTful APIs",
    description: "Accessing web-based data sources through RESTful APIs and extracting JSON data.",
    requires: ["pds.python.functions"],
  },
  {
    code: "pds.web.scraping",
    name: "Web scraping with BeautifulSoup",
    description: "Collecting data from the web by scraping pages with BeautifulSoup.",
    requires: ["pds.web.rest_api"],
  },

  // Fundamental of Machine Learning — Module 1
  {
    code: "ml.data_prep.missing_values",
    name: "Handling missing values",
    description: "Identifying and handling missing values when preparing data for modelling.",
    requires: ["pds.pandas.cleaning"],
  },
  {
    code: "ml.data_prep.scaling_encoding",
    name: "Feature scaling and encoding categorical variables",
    description:
      "Scaling numerical features and encoding categorical variables so they can be consumed by models.",
    requires: ["pds.pandas.dataframes"],
  },
  {
    code: "ml.data_prep.partitioning",
    name: "Data partitioning",
    description: "Splitting datasets for training and evaluation.",
    requires: ["pds.pandas.dataframes"],
  },
  {
    code: "ml.foundations.supervised",
    name: "Foundations of supervised learning",
    description:
      "Theoretical foundations of supervised machine learning and how models apply to classification and regression problems.",
    requires: ["pds.python.functions"],
  },
  {
    code: "ml.foundations.bias_variance",
    name: "Bias-variance tradeoff",
    description:
      "The bias-variance tradeoff and how it influences generalization and model complexity.",
    requires: ["ml.foundations.supervised"],
  },
  {
    code: "ml.sklearn.pipeline",
    name: "The machine learning pipeline in Scikit-learn",
    description: "Composing preparation and modelling steps into a Scikit-learn pipeline.",
    requires: ["pds.python.oop"],
  },
  // Fundamental of Machine Learning — Module 2
  {
    code: "ml.algo.linear_regression",
    name: "Linear regression",
    description: "Implementing and interpreting linear regression for regression tasks.",
    requires: ["ml.foundations.supervised", "ml.sklearn.pipeline"],
  },
  {
    code: "ml.algo.decision_trees",
    name: "Decision trees",
    description:
      "Implementing and interpreting decision trees for classification and regression tasks.",
    requires: ["ml.foundations.supervised"],
  },
  {
    code: "ml.algo.svm",
    name: "Support vector machines",
    description:
      "Implementing and interpreting support vector machines for classification and regression tasks.",
    requires: ["ml.foundations.supervised"],
  },
  {
    code: "ml.algo.selection",
    name: "Algorithm behaviour, assumptions, and use cases",
    description:
      "Understanding algorithm behaviour and model assumptions in order to select appropriate use cases.",
    requires: ["ml.algo.linear_regression", "ml.algo.decision_trees", "ml.algo.svm"],
  },
  // Fundamental of Machine Learning — Module 3
  {
    code: "ml.eval.metrics",
    name: "Evaluation metrics",
    description:
      "Assessing model performance with accuracy, precision, recall, F1-score, RMSE, and other relevant metrics.",
    requires: ["ml.foundations.supervised"],
  },
  {
    code: "ml.eval.cross_validation",
    name: "Cross-validation",
    description: "Applying cross-validation strategies to estimate generalization reliably.",
    requires: ["ml.eval.metrics", "ml.data_prep.partitioning"],
  },
  {
    code: "ml.eval.hyperparameter_tuning",
    name: "Hyperparameter tuning",
    description:
      "Improving model generalization through hyperparameter optimization such as grid search.",
    requires: ["ml.eval.cross_validation"],
  },
  {
    code: "ml.workflow.end_to_end",
    name: "End-to-end machine learning workflow",
    description:
      "Applying a complete machine learning workflow to a real-world dataset, from preparation through evaluation.",
    requires: ["ml.eval.hyperparameter_tuning", "ml.algo.selection", "ml.data_prep.missing_values"],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Course definitions. Every field traces back to the syllabus PDFs — the
// lesson bodies summarize the syllabus outline and learning outcomes rather
// than inventing teaching material.
// ─────────────────────────────────────────────────────────────────────────
interface LessonDef {
  title: string;
  description: string;
  body: string;
  skills: string[];
}
interface ModuleDef {
  title: string;
  lessons: LessonDef[];
}
interface CourseDef {
  slug: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  category: string;
  modules: ModuleDef[];
}

const PDS: CourseDef = {
  slug: "programming-for-data-science",
  title: "Programming for Data Science",
  description:
    "This foundational course introduces learners to Python, the most widely used programming language in data science and software development. By the end of this course, learners will be able to understand and apply core programming constructs (variables, data types, control flow, functions, and object-oriented programming); work proficiently with essential Python libraries such as NumPy and Pandas in Jupyter Notebooks; and access and retrieve data from the web using APIs and Python scraping tools such as BeautifulSoup.\n\nCollege of Technology — National Economics University. 2 credits — 30 hours of studying (20 hours class contact, 10 hours independent study) over 4 weeks. Offered February 2026. Pre-requisite: Principles of Programming. Assessment: Group Project and Presentation (40%), Final Exam (60%).",
  level: "beginner",
  category: "Data Science",
  modules: [
    {
      title: "Module 1: Fundamentals of Python Programming",
      lessons: [
        {
          title: "Course Overview",
          description:
            "How computer science, AI, machine learning, and data science relate — and where this course sits.",
          body: "## Course Overview\n\nA short introduction to the course and to the field it sits in.\n\n### What this video covers\n\n- How computer science, AI, machine learning, and deep learning relate to one another\n- Where data science sits relative to those fields\n- The role of mathematics and statistics, domain knowledge, and software development\n\n### Where this course fits\n\nThis course is the programming foundation. It gives you the Python, NumPy, Pandas, and data-collection skills that *Fundamental of Machine Learning* then builds on directly.",
          skills: ["pds.intro.landscape"],
        },
        {
          title: "Variables, Data Types, and Operators",
          description: "Core Python building blocks: variables, data types, and operators.",
          body: "## Variables, Data Types, and Operators\n\nThis lesson introduces the core building blocks of Python programming: variables, data types, and operators.\n\n### What you will learn\n\n- How Python stores values in variables\n- The built-in data types you will use throughout the course\n- Operators for combining and comparing values\n\n### Why it matters\n\nPython is the most widely used programming language in data science and software development. Every later topic in this course — NumPy, Pandas, APIs, scraping — builds directly on these constructs.\n\n### Reference\n\nMcKinney, W. (2022). *Python for Data Analysis: Data Wrangling with Pandas, NumPy, and Jupyter* (3rd ed.). O'Reilly Media.",
          skills: ["pds.python.basics"],
        },
        {
          title: "Control Flow: Conditionals and Loops",
          description: "Directing program execution with if statements and loops.",
          body: "## Control Flow: Conditionals and Loops\n\nControl flow determines the order in which your program's statements run.\n\n### What you will learn\n\n- `if` statements to branch on conditions\n- Loops to repeat work over collections and ranges\n- Combining conditionals and loops to express real logic\n\n### Why it matters\n\nData work is repetitive by nature — you rarely process one row, you process thousands. Loops and conditionals are how you express that.",
          skills: ["pds.python.control_flow"],
        },
        {
          title: "Functions",
          description: "Structuring Python programs with reusable functions.",
          body: "## Functions\n\nFunctions let you name a piece of logic and reuse it.\n\n### What you will learn\n\n- Defining and calling functions\n- Passing arguments and returning values\n- Structuring a program as a set of functions rather than one long script\n\n### Why it matters\n\nBy the end of this course you will write structured Python programs using both procedural and object-oriented approaches. Functions are the first half of that skill.",
          skills: ["pds.python.functions"],
        },
        {
          title: "Basic Object-Oriented Programming",
          description: "Writing structured Python using object-oriented approaches.",
          body: "## Basic Object-Oriented Programming\n\nThis lesson introduces object-oriented programming (OOP) in Python.\n\n### What you will learn\n\n- Classes and objects\n- Organising state and behaviour together\n- When an object-oriented approach fits better than a procedural one\n\n### Why it matters\n\nThe libraries you will use next — NumPy, Pandas, and later Scikit-learn — are themselves object-oriented. Understanding OOP makes their design legible rather than magical.",
          skills: ["pds.python.oop"],
        },
      ],
    },
    {
      title: "Module 2: Data Manipulation with NumPy and Pandas",
      lessons: [
        {
          title: "NumPy Arrays",
          description: "Working with numerical data using NumPy arrays.",
          body: "## NumPy Arrays\n\nNumPy is the foundation of numerical computing in Python.\n\n### What you will learn\n\n- Creating and indexing arrays\n- Working with numerical data efficiently\n- How arrays differ from plain Python lists\n\n### Why it matters\n\nPandas is built on top of NumPy. Understanding arrays first makes DataFrames much easier to reason about.\n\n### Reference\n\nMcKinney, W. (2022). *Python for Data Analysis: Data Wrangling with Pandas, NumPy, and Jupyter* (3rd ed.). O'Reilly Media.",
          skills: ["pds.numpy.arrays"],
        },
        {
          title: "Pandas DataFrames",
          description: "Working with tabular data using Pandas DataFrames.",
          body: "## Pandas DataFrames\n\nThe DataFrame is the central structure for tabular data in Python.\n\n### What you will learn\n\n- Creating DataFrames and inspecting their structure\n- Selecting rows and columns\n- Working proficiently with tabular data\n\n### Why it matters\n\nMost real data science work starts with a table. This is the tool you will reach for most often, in this course and after it.",
          skills: ["pds.pandas.dataframes"],
        },
        {
          title: "Data Cleaning and Transformation",
          description: "Cleaning and transforming tabular data with Pandas.",
          body: "## Data Cleaning and Transformation\n\nReal data arrives messy. This lesson covers making it usable.\n\n### What you will learn\n\n- Data cleaning techniques\n- Transforming columns and reshaping tables\n- Preparing data for analysis\n\n### Why it matters\n\nCleaning is where most of the time in a data project actually goes. It is also the direct prerequisite for the data preparation work in *Fundamental of Machine Learning*.",
          skills: ["pds.pandas.cleaning"],
        },
        {
          title: "Aggregation and Exploratory Data Analysis in Jupyter",
          description: "Aggregating data and exploring it interactively in Jupyter Notebooks.",
          body: "## Aggregation and Exploratory Data Analysis in Jupyter\n\nThis lesson brings the module together in the environment you will actually work in.\n\n### What you will learn\n\n- Aggregating data to summarise it\n- Exploratory data analysis (EDA)\n- Performing data processing tasks interactively in Jupyter Notebooks\n\n### Why it matters\n\nEDA is how you find out what a dataset actually contains before you model it. Jupyter is where that exploration happens.",
          skills: ["pds.pandas.eda"],
        },
      ],
    },
    {
      title: "Module 3: Accessing and Collecting Web Data",
      lessons: [
        {
          title: "Retrieving Data via RESTful APIs",
          description: "Accessing web-based data sources through RESTful APIs.",
          body: "## Retrieving Data via RESTful APIs\n\nNot all data comes as a file. Much of it lives behind an API.\n\n### What you will learn\n\n- Retrieving data via RESTful APIs\n- Extracting JSON data from responses\n- Turning API responses into structures you can analyse\n\n### Why it matters\n\nAccessing web-based data sources through RESTful APIs is one of the three practical outcomes of this course.",
          skills: ["pds.web.rest_api"],
        },
        {
          title: "Web Scraping with BeautifulSoup",
          description: "Collecting data from the web by scraping pages with BeautifulSoup.",
          body: "## Web Scraping with BeautifulSoup\n\nWhen there is no API, there is still the page itself.\n\n### What you will learn\n\n- Basic web scraping using BeautifulSoup\n- Extracting structured data from HTML\n- Collecting data from the modern web\n\n### Why it matters\n\nThis completes your ability to access and retrieve data from the web — the final learning outcome of the course.\n\n### Reference\n\nMitchell, R. (2018). *Web Scraping with Python: Collecting Data from the Modern Web* (2nd ed.). O'Reilly Media.",
          skills: ["pds.web.scraping"],
        },
      ],
    },
  ],
};

const ML: CourseDef = {
  slug: "fundamental-of-machine-learning",
  title: "Fundamental of Machine Learning",
  description:
    "This course delivers job-ready machine learning skills using Python and the Scikit-learn library. Learners will apply data preparation techniques and manage bias-variance tradeoffs for optimal model performance; implement core machine learning algorithms including linear regression, decision trees, and support vector machines (SVM) for both classification and regression tasks; and evaluate and fine-tune models using appropriate metrics, cross-validation, and hyperparameter optimization to ensure reliability and accuracy.\n\nCollege of Technology — National Economics University. 2 credits — 30 hours of studying (20 hours class contact, 10 hours independent study) over 4 weeks. Offered February 2026. Pre-requisites: Principles of Programming; Programming for Data Science; Introduction to Data Analysis. Assessment: Group Project and Presentation (40%), Final Exam (60%).",
  level: "intermediate",
  category: "Machine Learning",
  modules: [
    {
      title: "Module 1: Data Preparation and Model Foundations",
      lessons: [
        {
          title: "Handling Missing Values",
          description: "Identifying and handling missing values when preparing data for modelling.",
          body: "## Handling Missing Values\n\nThis lesson opens the essential steps in preparing data for machine learning tasks.\n\n### What you will learn\n\n- Identifying missing values in a dataset\n- Strategies for handling them\n- How the choice affects downstream model performance\n\n### Why it matters\n\nData preparation is the first of the three course outcomes. A model is only ever as good as the data handed to it.\n\n### Reference\n\nGéron, A. (2019). *Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow* (2nd ed.). O'Reilly Media.",
          skills: ["ml.data_prep.missing_values"],
        },
        {
          title: "Feature Scaling and Encoding Categorical Variables",
          description: "Preparing numerical and categorical features for modelling.",
          body: "## Feature Scaling and Encoding Categorical Variables\n\nModels consume numbers. This lesson covers getting your features into a form they accept.\n\n### What you will learn\n\n- Feature scaling\n- Encoding categorical variables\n- Applying preprocessing workflows to real-world datasets\n\n### Why it matters\n\nMany algorithms — SVM in particular — are sensitive to feature scale. Skipping this step silently degrades results.",
          skills: ["ml.data_prep.scaling_encoding"],
        },
        {
          title: "Data Partitioning",
          description: "Splitting datasets for training and evaluation.",
          body: "## Data Partitioning\n\nThis lesson covers splitting your data before you model it.\n\n### What you will learn\n\n- Data partitioning strategies\n- Why evaluation data must be held out\n- How partitioning connects to the validation work in Module 3\n\n### Why it matters\n\nEvaluating a model on the data it trained on tells you nothing about generalization. Partitioning is what makes honest evaluation possible.",
          skills: ["ml.data_prep.partitioning"],
        },
        {
          title: "Foundations of Supervised Learning and the Bias-Variance Tradeoff",
          description:
            "Theoretical foundations of supervised learning, and the tradeoff that governs generalization.",
          body: "## Foundations of Supervised Learning and the Bias-Variance Tradeoff\n\nThis lesson covers the conceptual core of the course.\n\n### What you will learn\n\n- Foundational concepts of supervised learning\n- How models apply to both classification and regression problems\n- The bias-variance tradeoff and how it influences generalization\n\n### Why it matters\n\nManaging bias-variance tradeoffs for optimal model performance is one of the three stated outcomes of this course. Every algorithm in Module 2 is a different point on this tradeoff.",
          skills: ["ml.foundations.supervised", "ml.foundations.bias_variance"],
        },
        {
          title: "The Machine Learning Pipeline in Scikit-learn",
          description: "Composing preparation and modelling steps into a Scikit-learn pipeline.",
          body: "## The Machine Learning Pipeline in Scikit-learn\n\nThis lesson closes the module by assembling the pieces.\n\n### What you will learn\n\n- The machine learning pipeline in Scikit-learn\n- Composing preparation and modelling steps\n- Structuring work so it is reproducible\n\n### Why it matters\n\nPipelines are how Scikit-learn keeps preparation and modelling in step — and how you avoid leaking test data into training.",
          skills: ["ml.sklearn.pipeline"],
        },
      ],
    },
    {
      title: "Module 2: Core Machine Learning Algorithms",
      lessons: [
        {
          title: "Linear Regression",
          description: "Implementing and interpreting linear regression for regression tasks.",
          body: "## Linear Regression\n\nThe first of the three core algorithms in this course.\n\n### What you will learn\n\n- Implementing linear regression\n- Interpreting the model\n- Applying it to regression tasks\n\n### Why it matters\n\nLinear regression is the baseline against which more complex models must justify themselves.",
          skills: ["ml.algo.linear_regression"],
        },
        {
          title: "Decision Trees",
          description:
            "Implementing and interpreting decision trees for classification and regression.",
          body: "## Decision Trees\n\nThe second core algorithm.\n\n### What you will learn\n\n- Implementing decision trees\n- Interpreting how a tree reaches a decision\n- Applying trees to both classification and regression tasks\n\n### Why it matters\n\nTrees are among the most interpretable models available — you can read the decision directly.",
          skills: ["ml.algo.decision_trees"],
        },
        {
          title: "Support Vector Machines",
          description:
            "Implementing and interpreting support vector machines for classification and regression.",
          body: "## Support Vector Machines\n\nThe third core algorithm.\n\n### What you will learn\n\n- Implementing support vector machines (SVM)\n- Interpreting SVM behaviour\n- Applying SVM to both classification and regression tasks\n\n### Why it matters\n\nSVM completes the set of core algorithms named in the course outcomes. Note its sensitivity to feature scaling — the Module 1 work pays off directly here.",
          skills: ["ml.algo.svm"],
        },
        {
          title: "Choosing Algorithms: Assumptions and Use Cases",
          description: "Selecting an appropriate algorithm from its behaviour and assumptions.",
          body: "## Choosing Algorithms: Assumptions and Use Cases\n\nThis lesson steps back from individual algorithms to the choice between them.\n\n### What you will learn\n\n- Algorithm behaviour and what drives it\n- Model assumptions\n- Appropriate use cases, through real-world examples\n\n### Why it matters\n\nKnowing three algorithms is less useful than knowing which one a problem calls for.",
          skills: ["ml.algo.selection"],
        },
      ],
    },
    {
      title: "Module 3: Model Evaluation and Optimization",
      lessons: [
        {
          title: "Evaluation Metrics: Accuracy, Precision, Recall, F1-score, and RMSE",
          description: "Assessing model performance with appropriate metrics.",
          body: "## Evaluation Metrics\n\nThis lesson covers assessing how well a model actually performs.\n\n### What you will learn\n\n- Accuracy, precision, recall, and F1-score\n- RMSE and other relevant metrics\n- Selecting appropriate evaluation metrics for the task\n\n### Why it matters\n\nA single accuracy number can hide a useless model. Choosing the right metric is part of the skill.",
          skills: ["ml.eval.metrics"],
        },
        {
          title: "Cross-Validation",
          description: "Applying cross-validation to estimate generalization reliably.",
          body: "## Cross-Validation\n\nThis lesson covers validating results systematically.\n\n### What you will learn\n\n- Cross-validation techniques\n- Applying validation strategies\n- Ensuring model reliability through systematic validation processes\n\n### Why it matters\n\nOne train/test split can be lucky. Cross-validation is how you find out whether your result survives resampling.",
          skills: ["ml.eval.cross_validation"],
        },
        {
          title: "Hyperparameter Tuning with Grid Search",
          description: "Improving generalization through hyperparameter optimization.",
          body: "## Hyperparameter Tuning with Grid Search\n\nThis lesson covers fine-tuning a working model.\n\n### What you will learn\n\n- Hyperparameter tuning\n- Grid search\n- Improving model generalization through optimization\n\n### Why it matters\n\nEvaluating and fine-tuning models to ensure reliability and accuracy is the third stated outcome of this course.",
          skills: ["ml.eval.hyperparameter_tuning"],
        },
        {
          title: "Applying a Complete Machine Learning Workflow",
          description: "Bringing preparation, modelling, and evaluation together on a real dataset.",
          body: "## Applying a Complete Machine Learning Workflow\n\nThe module — and the course — culminates here.\n\n### What you will learn\n\n- Applying a complete machine learning workflow to a real-world dataset\n- Connecting preparation, modelling, evaluation, and tuning into one process\n- Managing model complexity end to end\n\n### Why it matters\n\nThis is what the Group Project (40% of your assessment) asks you to demonstrate.\n\n### Reference\n\nGéron, A. (2019). *Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow* (2nd ed.). O'Reilly Media.",
          skills: ["ml.workflow.end_to_end"],
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────

async function ensureOwner(): Promise<{ userId: string; generatedPassword: string | null }> {
  const existing = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (existing) {
    console.log(`  owner: reusing ${OWNER_EMAIL} (${existing.id})`);
    return { userId: existing.id, generatedPassword: null };
  }

  // Random password — the account holder rotates it on first sign-in.
  const password = randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const instructorRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.Instructor },
  });

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: OWNER_EMAIL,
        passwordHash,
        displayName: OWNER_NAME,
        locale: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        // Provisioned by an admin, not self-registered — no verification mail
        // is sent, so mark the address trusted here or sign-in gates on it.
        emailVerifiedAt: new Date(),
      },
    });
    await tx.authProvider.create({
      data: { userId: u.id, provider: "password", providerUserId: OWNER_EMAIL },
    });
    await tx.userRole.create({ data: { userId: u.id, roleId: instructorRole.id } });
    return u;
  });

  console.log(`  owner: created ${OWNER_EMAIL} (${user.id})`);
  return { userId: user.id, generatedPassword: password };
}

async function ensureSkills(): Promise<Map<string, string>> {
  const byCode = new Map<string, string>();
  let created = 0;
  for (const s of SKILLS) {
    const existing = await prisma.skill.findUnique({ where: { code: s.code } });
    if (existing) {
      byCode.set(s.code, existing.id);
      continue;
    }
    // createSkill throws skill_code_taken rather than upserting, hence the
    // pre-check above.
    const { skillId } = await createSkill(
      { code: s.code, name: s.name, description: s.description },
      prisma,
    );
    byCode.set(s.code, skillId);
    created++;
  }
  console.log(`  skills: ${created} created, ${SKILLS.length - created} already present`);

  let edges = 0;
  for (const s of SKILLS) {
    for (const req of s.requires ?? []) {
      const skillId = byCode.get(s.code);
      const prereqId = byCode.get(req);
      if (!skillId || !prereqId) throw new Error(`unknown skill in prerequisite: ${s.code} <- ${req}`);
      // Idempotent + cycle-checked inside the service.
      await addSkillPrerequisite(skillId, prereqId, prisma);
      edges++;
    }
  }
  console.log(`  skill prerequisites: ${edges} edges ensured`);
  return byCode;
}

async function ensureCourse(
  def: CourseDef,
  ownerId: string,
  skillsByCode: Map<string, string>,
): Promise<void> {
  console.log(`\n[${def.title}]`);

  let course = await prisma.course.findUnique({ where: { slug: def.slug } });
  if (!course) {
    const { courseId } = await createCourse(
      ownerId,
      {
        title: def.title,
        description: def.description,
        slug: def.slug,
        language: "en",
        level: def.level,
        category: def.category,
        personalizationEnabled: true,
      },
      prisma,
    );
    course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    console.log(`  course: created (${course.slug})`);
  } else {
    console.log(`  course: reusing existing (${course.slug})`);
  }

  for (const [mIdx, mod] of def.modules.entries()) {
    let moduleRow = await prisma.module.findFirst({
      where: { courseId: course.id, title: mod.title },
    });
    if (!moduleRow) {
      const { moduleId } = await createModule(
        ownerId,
        course.id,
        { title: mod.title, orderIndex: mIdx },
        prisma,
      );
      moduleRow = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
      console.log(`  module ${mIdx + 1}: created — ${mod.title}`);
    } else {
      console.log(`  module ${mIdx + 1}: reusing — ${mod.title}`);
    }

    for (const [lIdx, lesson] of mod.lessons.entries()) {
      let lessonRow = await prisma.lesson.findFirst({
        where: { moduleId: moduleRow.id, title: lesson.title },
      });
      if (!lessonRow) {
        const { lessonId } = await createLesson(
          ownerId,
          moduleRow.id,
          { title: lesson.title, orderIndex: lIdx, description: lesson.description },
          prisma,
        );
        lessonRow = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
      }

      // createContentItem also writes the LessonActivity row the timeline reads.
      const hasContent = await prisma.contentItem.findFirst({
        where: { lessonId: lessonRow.id },
      });
      if (!hasContent) {
        await createContentItem(
          ownerId,
          lessonRow.id,
          { type: "markdown", payload: { body: lesson.body }, orderIndex: 0 },
          prisma,
        );
      }

      for (const code of lesson.skills) {
        const skillId = skillsByCode.get(code);
        if (!skillId) throw new Error(`lesson "${lesson.title}" references unknown skill ${code}`);
        await tagLessonSkill(ownerId, lessonRow.id, { skillId }, prisma);
      }
      console.log(
        `    lesson ${lIdx + 1}: ${lesson.title} [${lesson.skills.join(", ")}]`,
      );
    }
  }

  // personalizationEnabled is on, so this gate rejects any untagged lesson.
  await publishCourse(ownerId, course.id, prisma);
  console.log(`  published.`);
}

async function main() {
  const target = process.env.DATABASE_URL?.replace(/:[^:@/]*@/, ":***@") ?? "(unset)";
  console.log(`Target: ${target}\n`);

  const { userId, generatedPassword } = await ensureOwner();
  const skillsByCode = await ensureSkills();

  await ensureCourse(PDS, userId, skillsByCode);
  await ensureCourse(ML, userId, skillsByCode);

  console.log("\n─── Done ───");
  if (generatedPassword) {
    console.log(`Sign-in for ${OWNER_EMAIL}: ${generatedPassword}`);
    console.log("Change this on first sign-in.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
