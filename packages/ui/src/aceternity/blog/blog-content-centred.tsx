"use client";
import { format } from "date-fns";
import React from "react";
import ReactMarkdown from "react-markdown";
export function BlogContentCentered() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
      <img
        src={blog.thumbnail}
        alt={blog.title}
        className="h-60 w-full rounded-3xl object-cover md:h-[30rem]"
        height={720}
        width={1024}
      />
      <h2 className="mt-6 mb-2 text-2xl font-bold tracking-tight text-black dark:text-white">
        {blog.title}
      </h2>
      <div className="flex items-center">
        <img
          src={blog.authorImage}
          alt={blog.author}
          className="h-5 w-5 rounded-full"
          height={20}
          width={20}
        />
        <p className="pl-2 text-sm text-neutral-600 dark:text-neutral-400">
          {blog.author}
        </p>
        <div className="mx-2 h-1 w-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        <p className="pl-1 text-sm text-neutral-600 dark:text-neutral-400">
          {format(new Date(blog.date), "LLLL d, yyyy")}
        </p>
      </div>
      <div className="prose prose-sm dark:prose-invert mt-10 sm:mt-20">
        <ReactMarkdown>{blog.content}</ReactMarkdown>
      </div>
    </div>
  );
}

const dummyContentMarkdown = `

## Introduction

Artificial Intelligence (AI) has been rapidly evolving, transforming various aspects of our lives. From voice assistants to autonomous vehicles, AI is becoming increasingly integrated into our daily routines.

### Key Areas of AI Development

1. **Machine Learning**
   - Deep Learning
   - Neural Networks
   - Reinforcement Learning

2. **Natural Language Processing**
   - Language Translation
   - Sentiment Analysis
   - Chatbots and Virtual Assistants

3. **Computer Vision**
   - Image Recognition
   - Facial Recognition
   - Autonomous Vehicles

## Ethical Considerations

As AI continues to advance, it's crucial to address ethical concerns:

- Privacy and data protection
- Bias in AI algorithms
- Job displacement due to automation

## Conclusion

The future of AI is both exciting and challenging. As we continue to push the boundaries of what's possible, it's essential to balance innovation with responsible development and implementation.

> "The development of full artificial intelligence could spell the end of the human race." - Stephen Hawking

*This quote reminds us of the importance of careful consideration in AI advancement.*

![AI Concept Image](https://images.unsplash.com/photo-1719716136369-59ecf938a911?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)

For more information, visit [AI Research Center](https://example.com/ai-research).
`;

type Blog = {
  title: string;
  summary?: string;
  date: string;
  author: string;
  authorImage: string;
  thumbnail: string;
  content: string;
};
const blog: Blog = {
  title: "The Future of Artificial Intelligence",
  summary:
    "Artificial Intelligence (AI) has been rapidly evolving, transforming various aspects of our lives. From voice assistants to autonomous vehicles, AI is becoming increasingly integrated into our daily routines.",
  date: "2024-02-14",
  author: "John Doe",
  authorImage: "https://assets.aceternity.com/manu.png",
  thumbnail:
    "https://images.unsplash.com/photo-1719716136369-59ecf938a911?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  content: dummyContentMarkdown,
};
