import { useEffect, useState } from "react";
import API from "../services/api";

const Subjects = () => {

  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  const [form, setForm] = useState({
    name: "",
    school_class: ""
  });

  useEffect(() => {
    loadSubjects();
    loadClasses();
  }, []);

  const loadSubjects = async () => {
    try {
      const res = await API.get("/subjects/");
      setSubjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadClasses = async () => {
    try {
      const res = await API.get("/classes/");
      setClasses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const createSubject = async (e) => {

    e.preventDefault();

    try {

      await API.post("/subjects/", form);

      setForm({
        name: "",
        school_class: ""
      });

      loadSubjects();

    } catch (err) {
      console.error(err);
    }

  };

  const deleteSubject = async (id) => {

    if (!window.confirm("Delete subject?")) return;

    try {

      await API.delete(`/subjects/${id}/`);
      loadSubjects();

    } catch (err) {
      console.error(err);
    }

  };

  return (

    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Subjects
      </h1>

      {/* Create Subject */}

      <form
        onSubmit={createSubject}
        className="flex gap-4 mb-6"
      >

        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Subject name"
          className="border p-2"
          required
        />

        <select
          name="school_class"
          value={form.school_class}
          onChange={handleChange}
          className="border p-2"
          required
        >

          <option value="">Select Class</option>

          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}

        </select>

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Add Subject
        </button>

      </form>

      {/* Subjects Table */}

      <table className="w-full border shadow">

        <thead className="bg-gray-200">

          <tr>
            <th className="p-2">Subject</th>
            <th className="p-2">Class</th>
            <th className="p-2">Action</th>
          </tr>

        </thead>

        <tbody>

          {subjects.map((s) => (

            <tr key={s.id} className="border-t">

              <td className="p-2">{s.name}</td>
              <td className="p-2">{s.class_name}</td>

              <td className="p-2">

                <button
                  onClick={() => deleteSubject(s.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

};

export default Subjects;